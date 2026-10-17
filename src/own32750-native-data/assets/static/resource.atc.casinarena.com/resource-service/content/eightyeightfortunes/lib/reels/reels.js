define(["require", "exports", "TimelineLite", "TimelineMax", "TweenMax"], function (require, exports, TimelineLite, TimelineMax, TweenMax) {
    /**
     * Logical reel that maintains the symbol layout
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
    /**
     * Payline part enumeration
     */
    (function (PaylinePart) {
        PaylinePart[PaylinePart["None"] = 0] = "None";
        PaylinePart[PaylinePart["Line"] = 1] = "Line";
        PaylinePart[PaylinePart["Box"] = 2] = "Box";
    })(exports.PaylinePart || (exports.PaylinePart = {}));
    var PaylinePart = exports.PaylinePart;
    /**
     * Contains functionality for displaying a lines and boxes display of paylines
     */
    var PaylineDisplay = (function () {
        /**
         * Create a new BoxDisplay object
         *
         * @param  grid  grid that will be used to draw the lines
         * @param  vgActor  actor that contains the vector graphics used to draw
         * @param  lines  collection of line grid coordinates
         */
        function PaylineDisplay(grid, vgActor, lines) {
            this.grid = grid;
            this.vgActor = vgActor;
            this.lines = lines;
            this.vgActor.getTransform().setVisible(false);
            this.vgActor.getVectorGraphics().setVisible(true);
        }
        /**
         * Get the payline grid
         */
        PaylineDisplay.prototype.getPaylineGrid = function () {
            return this.grid;
        };
        /**
         * Get a payline
         *
         * @param  id  the payline id
         */
        PaylineDisplay.prototype.getPayline = function (id) {
            return this.lines[id];
        };
        /**
         * Get the number of paylines that could be drawn
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
        PaylineDisplay.prototype.show = function (payline, parts, darken) {
            this.drawLines(payline, payline + 1, parts, darken);
            this.vgActor.getTransform().setVisible(true);
        };
        /**
         * Redraws the display based to show a single payline
         *
         * @param  lineCount  number of paylines to show.
         * @param  parts  collection of payline parts. Number of parts must match number of payline
         *                targets.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.showLines = function (lineCount, parts, darken) {
            this.drawLines(0, lineCount, parts, darken);
            this.vgActor.getTransform().setVisible(true);
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
        PaylineDisplay.prototype.showCustom = function (payline, parts, targets, darken, drawLines) {
            this.drawLineCustom(payline, parts, targets, darken, drawLines);
            this.vgActor.getTransform().setVisible(true);
        };
        /**
         * Redraws the display based to show a single payline
         *
         * @param  lineCount  payline number to show. 0 based.
         * @param  targets  custom payline targets
         */
        PaylineDisplay.prototype.showSinglePayline = function (lineCount, parts) {
            this.vgActor.getTransform().setVisible(true);
            this.drawSingleLine(lineCount, lineCount + 1, parts, false);
        };
        /**
         * Hide the display
         */
        PaylineDisplay.prototype.hide = function () {
            this.vgActor.getTransform().setVisible(false);
        };
        /**
         * Clear the display
         */
        PaylineDisplay.prototype.clear = function () {
            var vgComp = this.vgActor.getVectorGraphics();
            vgComp.clear();
        };
        /**
         * Draws a set of the lines in the display. This will draw all lines
         * in the collection up to a certain index.
         *
         * @param  drawFromIndex  lines array index to draw lines from
         * @param  drawToIndex  lines array index to draw all lines up to
         * @param  parts  collection of payline parts.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.drawLines = function (drawFromIndex, drawToIndex, parts, darken) {
            var vgComp = this.vgActor.getVectorGraphics();
            vgComp.clear();
            for (var i = Math.max(drawFromIndex, 0); i < drawToIndex; ++i) {
                var line = this.lines[i];
                if (line.outline) {
                    vgComp.setStrokeStyle(line.lineWidth, "round", "miter").beginStroke(line.outlineColor);
                    this.tracePath(vgComp, line, parts, true);
                }
                vgComp.setStrokeStyle(line.lineWidth - 2, "round", "miter").beginStroke(line.getLineColor(darken));
                this.tracePath(vgComp, line, parts, true);
            }
        };
        /**
         * Draws a set of the lines in the display. This will draw all lines
         * in the collection up to a certain index.
         *
         * @param  drawFromIndex  lines array index to draw lines from
         * @param  drawToIndex  lines array index to draw all lines up to
         * @param  parts  collection of payline parts.
         * @param  darken  true to darken the lines
         * @param  drawLines  true to always draw lines from box to box
         */
        PaylineDisplay.prototype.drawLineCustom = function (lineIndex, parts, targets, darken, drawLines) {
            var vgComp = this.vgActor.getVectorGraphics();
            vgComp.clear();
            var line = this.lines[lineIndex];
            line.targets = targets;
            if (line.outline) {
                vgComp.setStrokeStyle(line.lineWidth, "round", "miter").beginStroke(line.outlineColor);
                this.tracePath(vgComp, line, parts, drawLines);
            }
            vgComp.setStrokeStyle(line.lineWidth - 2, "round", "miter").beginStroke(line.getLineColor(darken));
            this.tracePath(vgComp, line, parts, drawLines);
        };
        /**
         * Draws a line in the display. This will draw all lines
         * in the collection up to a certain index.
         *
         * @param  drawFromIndex  lines array index to draw lines from
         * @param  drawToIndex  lines array index to draw all lines up to
         * @param  parts  collection of payline parts.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.drawSingleLine = function (drawFromIndex, drawToIndex, parts, darken) {
            var vgComp = this.vgActor.getVectorGraphics();
            for (var i = Math.max(drawFromIndex, 0); i < drawToIndex; ++i) {
                var line = this.lines[i];
                if (line.outline) {
                    vgComp.setStrokeStyle(line.lineWidth, "round", "miter").beginStroke(line.outlineColor);
                    this.tracePath(vgComp, line, parts, true);
                }
                vgComp.setStrokeStyle(line.lineWidth - 2, "round", "miter").beginStroke(line.getLineColor(darken));
                this.tracePath(vgComp, line, parts, true);
            }
        };
        /**
         * Draws the path based on the line targets
         *
         * @param  vgComp  the vector graphics component
         * @param  line  the payline to draw
         * @param  parts  payline part spec
         * @param  drawLines  true to always draw lines from box to box
         */
        PaylineDisplay.prototype.tracePath = function (vgComp, line, parts, drawLines) {
            for (var i = 0; i < line.targets.length; ++i) {
                if (parts[i] == 0 /* None */) {
                    continue;
                }
                var targetWidth = this.grid.getTargetWidth();
                var targetHeight = this.grid.getTargetHeight();
                var columnIndex = i + line.columnStartIndex;
                var targetPosition = [
                    this.grid.getTargetPosX(columnIndex, line.targets[i]),
                    this.grid.getTargetPosY(columnIndex, line.targets[i])
                ];
                var targetTopLeftX = targetPosition[0] - (targetWidth * 0.5);
                var targetTopLeftY = targetPosition[1] - (targetHeight * 0.5);
                var targetBottomRightX = targetPosition[0] + (targetWidth * 0.5);
                var targetBottomRightY = targetPosition[1] + (targetHeight * 0.5);
                if (parts[i] == 2 /* Box */) {
                    this.drawBox(i, vgComp, line, parts, drawLines, targetWidth, targetHeight, targetTopLeftX, targetTopLeftY, targetBottomRightX, targetBottomRightY);
                }
                else if (drawLines) {
                    var toBox = false;
                    var ttx = targetPosition[0];
                    var tty = targetPosition[1];
                    var ltx = targetPosition[0];
                    var lty = targetPosition[1];
                    if (i != 0) {
                        ltx = this.grid.getTargetPosX(columnIndex - 1, line.targets[i - 1]);
                        lty = this.grid.getTargetPosY(columnIndex - 1, line.targets[i - 1]);
                        toBox = (parts[i - 1] == 2 /* Box */);
                        if (i != parts.length - 1 && !toBox) {
                            toBox = (parts[i + 1] == 2 /* Box */);
                            if (toBox) {
                                ltx = this.grid.getTargetPosX(columnIndex + 1, line.targets[i + 1]);
                                lty = this.grid.getTargetPosY(columnIndex + 1, line.targets[i + 1]);
                            }
                        }
                    }
                    else {
                        ltx = this.grid.getTargetPosX(columnIndex + 1, line.targets[i + 1]);
                        lty = this.grid.getTargetPosY(columnIndex + 1, line.targets[i + 1]);
                        toBox = (parts[i + 1] == 2 /* Box */);
                    }
                    if (toBox) {
                        if (lty < tty - targetHeight) {
                            if (ltx > ttx) {
                                ltx = ltx - (targetWidth * 0.25);
                            }
                            else {
                                ltx = ltx + (targetWidth * 0.25);
                            }
                            lty = lty + (targetHeight * 0.5);
                        }
                        else if (lty < tty) {
                            if (ltx > ttx) {
                                ltx = ltx - (targetWidth * 0.5);
                            }
                            else {
                                ltx = ltx + (targetWidth * 0.5);
                            }
                            lty = lty + (targetHeight * 0.5);
                        }
                        else if (lty == tty) {
                            if (ltx > ttx) {
                                ltx = ltx - (targetWidth * 0.5);
                            }
                            else {
                                ltx = ltx + (targetWidth * 0.5);
                            }
                        }
                        else if (lty > tty + targetHeight) {
                            if (ltx > ttx) {
                                ltx = ltx - (targetWidth * 0.25);
                            }
                            else {
                                ltx = ltx + (targetWidth * 0.25);
                            }
                            lty = lty - (targetHeight * 0.5);
                        }
                        else {
                            if (ltx > ttx) {
                                ltx = ltx - (targetWidth * 0.5);
                            }
                            else {
                                ltx = ltx + (targetWidth * 0.5);
                            }
                            lty = lty - (targetHeight * 0.5);
                        }
                    }
                    ///ianc 
                    if (i == 0) {
                        vgComp.moveTo(ttx - (targetWidth * 0.5), tty).lineTo(ttx, tty);
                    }
                    //end
                    vgComp.moveTo(ltx, lty).lineTo(ttx, tty);
                    //ianc
                    if (i == line.targets.length - 1) {
                        vgComp.moveTo(ttx, tty).lineTo(ttx + (targetWidth * 0.5), tty);
                    }
                    //end
                    // If we are drawing a line from box to box
                    if ((i != 0) && (i != line.targets.length - 1) && (parts[i - 1] == 2 /* Box */) && (parts[i + 1] == 2 /* Box */)) {
                        this.drawLineFromBoxToBox(i, vgComp, line, targetWidth, targetHeight, ltx, lty, targetPosition);
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
            vgComp.moveTo(tlcx, tlcy).lineTo(tlcx + tw, tlcy).lineTo(brcx, brcy).lineTo(tlcx, tlcy + th).closePath();
            if ((i != 0) && (parts[i - 1] == 2 /* Box */) && drawLines) {
                var lastTarget = [
                    this.grid.getTargetPosX(i - 1, line.targets[i - 1]),
                    this.grid.getTargetPosY(i - 1, line.targets[i - 1])
                ];
                if (lastTarget[1] < tlcy - th) {
                    vgComp.moveTo(tlcx + tw * 0.25, tlcy).lineTo(lastTarget[0] + tw * 0.25, lastTarget[1] + th * 0.5);
                }
                else if (lastTarget[1] > tlcy + th) {
                    vgComp.moveTo(tlcx + tw * 0.25, brcy).lineTo(lastTarget[0] + tw * 0.25, lastTarget[1] - th * 0.5);
                }
            }
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
    })();
    exports.PaylineDisplay = PaylineDisplay;
    /**
     * Class that handles cycling through payline wins
     */
    var CycleResults = (function () {
        /**
         * Create a new CycleResults object
         *
         * @param  paylineDisplay  paylines display used to show wins
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        function CycleResults(paylineDisplay, blinkCycles, cycleTime) {
            this.onNextResult = function () {
            };
            this.onResultsComplete = function () {
            };
            this.onDisplay = function () {
            };
            this.cycles = -1;
            this.paylineDisplay = paylineDisplay;
            this.currentResult = 0;
            this.currentCycle = 0;
            this.isCycling = false;
            this.showScatters = true;
            this.cycleTimeline = CycleResultsFactory.createCycleTimeline(this, blinkCycles, cycleTime);
        }
        /**
         * Set the callback called when the results are switching
         *
         * @param  onNextResult  function called when results are switching
         */
        CycleResults.prototype.setOnNextResult = function (onNextResult) {
            this.onNextResult = onNextResult;
        };
        /**
         * Set the callback called when all results have been displayed
         *
         * @param  onResultsComplete  function called when all results have been displayed
         */
        CycleResults.prototype.setOnResultsComplete = function (onResultsComplete) {
            this.onResultsComplete = onResultsComplete;
        };
        /**
         * Set the callback called just before paylines are displayed
         *
         * @param  func  function to call
         */
        CycleResults.prototype.setOnDisplay = function (func) {
            this.onDisplay = func;
        };
        /**
         * Set the cycle count or -1 for infinite
         *
         * @param  cycles  the cycle count
         */
        CycleResults.prototype.setCycleCount = function (cycles) {
            this.cycles = cycles;
        };
        /**
         * Set whether scatter winboxes will be displayed
         *
         * @param  show  true to show scatters
         */
        CycleResults.prototype.setShowScatters = function (show) {
            this.showScatters = show;
        };
        /**
         * Get the cycling status
         */
        CycleResults.prototype.getIsCycling = function () {
            return this.isCycling;
        };
        /**
         * Get the payline display
         */
        CycleResults.prototype.getPaylineDisplay = function () {
            return this.paylineDisplay;
        };
        /**
         * Starting cycling through the collection of results
         *
         * @param  results  collection of results used when cycling
         */
        CycleResults.prototype.start = function (results) {
            this.results = results;
            this.currentResult = 0;
            this.currentCycle = 0;
            this.isCycling = true;
            this.cycleTimeline.play(0);
            //Advance isn't called until the 2nd result so we need to call it manually
            //for the first result to play symbol animations
            this.onNextResult(this.results[this.currentResult]);
        };
        /**
         * Stops the results cycling. Only stops if the cycles are unlimited.
         *
         * @param suppressEvents  true to not invoke callbacks as a result of this call
         */
        CycleResults.prototype.stop = function (suppressEvents) {
            if (suppressEvents === void 0) { suppressEvents = false; }
            var wasCycling = this.isCycling;
            this.paylineDisplay.hide();
            this.cycleTimeline.pause();
            this.isCycling = false;
            if (wasCycling && !suppressEvents) {
                this.onResultsComplete();
            }
        };
        /**
         * Display the current result
         *
         * @param  dark  true to display dark
         */
        CycleResults.prototype.display = function (dark) {
            var sr = this.results[this.currentResult];
            var parts = new Array();
            var targets;
            if (sr.scatter) {
                targets = [0, 0, 0, 0, 0];
            }
            for (var i = 0; i < sr.layout.length; ++i) {
                if (sr.layout[i] >= 0) {
                    parts.push(2 /* Box */);
                    if (sr.scatter) {
                        targets[i] = sr.layout[i];
                    }
                }
                else if (sr.scatter) {
                    parts.push(0 /* None */);
                }
                else {
                    parts.push(1 /* Line */);
                }
            }
            this.onDisplay(sr, parts, dark);
            if (sr.scatter && this.showScatters) {
                this.paylineDisplay.showCustom(sr.payline, parts, targets, dark, false);
            }
            else {
                this.paylineDisplay.show(sr.payline, parts, dark);
            }
        };
        /**
         * Advance to next result
         */
        CycleResults.prototype.advance = function () {
            // Check if all results have been displayed
            if (++this.currentResult == this.results.length) {
                this.currentResult = 0;
                this.onResultsComplete();
                //Check if the cycle count has been reached
                if ((this.cycles > 0) && (++this.currentCycle == this.cycles)) {
                    this.stop();
                }
            }
            // Callback may have called stop or cycle count may have been reached,
            // so make sure we aren't stopped before advancing
            if (!this.cycleTimeline.paused()) {
                var sr = this.results[this.currentResult];
                this.onNextResult(sr);
            }
        };
        return CycleResults;
    })();
    exports.CycleResults = CycleResults;
    /**
     * Contains layout data and functionality for the underlying grid
     * for paylines.
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
         * @param  translationScale  scale factor to calculate anchor. scale of 1 is no scaling
         */
        function PaylineGrid(anchorX, anchorY, width, height, targetWidth, targetHeight, gridSpacingX, gridSpacingY, translationScale) {
            this.anchorX = anchorX;
            this.anchorY = anchorY;
            this.width = width;
            this.height = height;
            this.targetWidth = targetWidth;
            this.targetHeight = targetHeight;
            this.gridSpacingX = gridSpacingX * translationScale;
            this.gridSpacingY = gridSpacingY * translationScale;
            this.generate(translationScale);
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
        PaylineGrid.prototype.generate = function (translationScale) {
            var x = this.anchorX;
            var y = this.anchorY;
            if (translationScale != 1) {
                // We need to scale the positions based on the distance from the origin
                var theta = Math.atan2(this.anchorY, this.anchorX);
                var h = this.anchorY / Math.sin(theta);
                var h1 = h * translationScale;
                var x1 = h1 * Math.cos(theta);
                var y1 = h1 * Math.sin(theta);
                if (x == 0) {
                    y = Math.floor(y * translationScale);
                }
                else if (y == 0) {
                    x = Math.floor(x * translationScale);
                }
                else {
                    x = x1;
                    y = y1;
                }
                x = Math.floor(x);
                y = Math.floor(y);
            }
            this.targets = new Array();
            for (var row = 0; row < this.height; ++row) {
                this.targets.push(new Array());
                for (var col = 0; col < this.width; ++col) {
                    this.targets[row].push([(x + ((col + 1) * this.targetWidth) - this.targetWidth * 0.5), y + ((row + 1) * this.targetHeight) - this.targetHeight * 0.5]);
                    if (col != 0) {
                        this.targets[row][col][0] += this.gridSpacingX * col;
                    }
                    if (row != 0) {
                        this.targets[row][col][1] += this.gridSpacingY * row;
                    }
                }
            }
        };
        return PaylineGrid;
    })();
    exports.PaylineGrid = PaylineGrid;
    /**
     * Settings that can be used with addUnbreakableGroup
     */
    (function (UnbreakableGroupType) {
        UnbreakableGroupType[UnbreakableGroupType["Extend"] = -1] = "Extend";
        UnbreakableGroupType[UnbreakableGroupType["Neighbor"] = -2] = "Neighbor"; // Don't break up a symbol and single contiguous symbol
    })(exports.UnbreakableGroupType || (exports.UnbreakableGroupType = {}));
    var UnbreakableGroupType = exports.UnbreakableGroupType;
    /**
     * Contains collections of symbol ids that descrive the backing layout of a reel
     */
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
    /**
     * Contains settings of a payline
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
        function Payline(targets, lineWidth, outline, color, darkPercent, outlineColor, columnStartIndex) {
            if (columnStartIndex === void 0) { columnStartIndex = 0; }
            this.targets = targets;
            this.lineWidth = lineWidth;
            this.outline = outline;
            this.color = color;
            this.darkPercent = darkPercent;
            this.outlineColor = outlineColor;
            this.columnStartIndex = columnStartIndex;
        }
        /**
         * Get the color string for the main line color
         *
         * @param  darken  true to darken the line based on the dark percent
         */
        Payline.prototype.getLineColor = function (darken) {
            if (darken) {
                var r = Math.ceil(this.color[0] * 0.01 * this.darkPercent);
                var g = Math.ceil(this.color[1] * 0.01 * this.darkPercent);
                var b = Math.ceil(this.color[2] * 0.01 * this.darkPercent);
                return ("rgb(" + r + "," + g + "," + b + ")");
            }
            return ("rgb(" + this.color[0] + "," + this.color[1] + "," + this.color[2] + ")");
        };
        return Payline;
    })();
    exports.Payline = Payline;
    /**
     * Factory methods for cycle results
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
    exports.CycleResultsFactory = CycleResultsFactory;
    /**
     * Describes a reel layout
     */
    var Layout = (function () {
        /**
         * Create a new Layout object
         *
         * @param  reel  the logical reel
         * @param  symbolSet  source of symbol images
         * @param  anchor  parent of all symbols
         * @param  symbols  symbol actors
         * @param  bounds  rect used for reel bounds
         */
        function Layout(reel, symbolSet, anchor, symbols) {
            this.reel = reel;
            this.symbolSet = symbolSet;
            this.anchor = anchor;
            this.symbols = symbols;
            this.symbolWindow = new Array();
            this.symbolWindow.length = this.symbols.length;
            this.stopWindow = new Array();
            this.stopWindow.length = this.symbols.length;
            this.symbolOffsets = new Array();
            this.refreshSymbols();
        }
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
            var symbol = this.symbolSet.spriteSheet.getFrame(0);
            var xfm = this.anchor.getTransform();
            xfm.setPosition(Math.floor(originX + (offsetX * (symbol.w + spacingX))), Math.floor(originY + (offsetY * (symbol.h + spacingY))));
        };
        /**
         * Set the distance to offset a symbol. This is used to
         * make a symbol overlap the neighboring symbol. Positive numbers offset up.
         */
        Layout.prototype.setSymbolSet = function (symbolSet) {
            this.symbolSet = symbolSet;
            this.refreshSymbols();
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
        Layout.prototype.getBounds = function (bounds) {
            var xfm = this.anchor.getTransform();
            var w = this.symbolSet.spriteSheet.getFrame(0).drawW;
            var h = this.symbolSet.spriteSheet.getFrame(0).drawH;
            var visible = this.symbolWindow.length - 2;
            bounds.set(xfm.getTranslatedPositionX(), xfm.getTranslatedPositionY() + h, w, h * visible);
        };
        /**
         * Get the unscaled bounding rect that contains the visible portion of the reel
         */
        Layout.prototype.getUnscaledBounds = function (bounds) {
            var xfm = this.anchor.getTransform();
            var w = this.symbolSet.spriteSheet.getFrame(0).w;
            var h = this.symbolSet.spriteSheet.getFrame(0).h;
            var visible = this.symbolWindow.length - 2;
            bounds.set(xfm.getPositionX(), xfm.getPositionY() + h, w, h * visible);
        };
        /**
         * Set the anchor visibility
         *
         * @param  visible  the visibility
         */
        Layout.prototype.setVisible = function (visible) {
            this.anchor.getTransform().setVisible(visible);
        };
        /**
         * Position symbols in proper locations using default order (order of actors
         * when setSymbols was called)
         */
        Layout.prototype.layout = function () {
            this.endPosition = this.getSymbolPosition(this.symbols.length);
            for (var i = 0; i < this.symbols.length; ++i) {
                var xfm = this.symbols[i].getTransform();
                xfm.setPosition(0, this.getSymbolPosition(i));
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
                var image = symbol.getImage();
                var symId = this.symbolWindow[i];
                var frame = this.symbolSet.getSymbol(symId);
                image.setFrame(frame);
                //Update the symbol offset
                if (this.symbolOffsets[symId] != undefined) {
                    symbol.getTransform().setZOrder(1);
                    symbol.getTransform().setPivotY(this.symbolOffsets[symId]);
                }
                else {
                    symbol.getTransform().setZOrder(0);
                    symbol.getTransform().setPivotY(0);
                }
            }
        };
        /**
         * Set the image of a symbol actor from symbol id
         */
        Layout.prototype.setSymbol = function (windowIndex, symbolId, symbolOrder) {
            var symbol = this.getSymbolActor(windowIndex, symbolOrder);
            var frame = this.symbolSet.getSymbol(symbolId);
            symbol.getImage().setFrame(frame);
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
            return this.symbolSet.spriteSheet.getFrame(0).w;
        };
        /**
         * Get the height of symbols
         */
        Layout.prototype.getSymbolHeight = function () {
            return this.symbolSet.spriteSheet.getFrame(0).h;
        };
        /**
         * Get the space between symbols
         */
        Layout.prototype.getSymbolSpacing = function () {
            return this.symbolSet.spriteSheet.getFrame(0).h;
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
            if (this.reel.getStrip().isReelSwitch())
                this.reel.getStopWindowReelSwitch(stopIndex, range);
            else
                this.reel.getStopWindow(stopIndex, range);
        };
        /**
         * Get the position of a symbol on the reel
         *
         * @param  windowIndex  index of symbol actor in symbol window
         */
        Layout.prototype.getSymbolPosition = function (windowIndex) {
            return this.getStartPosition() + (this.getSymbolSpacing() * windowIndex);
        };
        /**
         * Get the current index into the reel strip. The index of the center symbol.
         */
        Layout.prototype.getCurrentStripIndex = function () {
            return this.reel.getCurrentIndex();
        };
        /**
         * Count the number of symbols in a visible clump
         *
         * @param  stopIndex  the stop index
         */
        Layout.prototype.getVisibleClumpCountInStopWindow = function (stopIndex) {
            this.reel.getStopWindow(stopIndex, this.stopWindow);
            var count = 0;
            var clumpId = this.reel.getStrip().getClumpSymbol();
            for (var i = 1; i < this.stopWindow.length - 1; ++i) {
                var symbolId = this.stopWindow[i];
                if (symbolId == clumpId) {
                    ++count;
                }
                else if (count > 0) {
                    break;
                }
            }
            return count;
        };
        /**
         * Report if the given window index is going to be a clump symbol when the reel stops
         *
         * @param  windowIndex  the window index to check
         */
        Layout.prototype.getIsClumpInStopWindow = function (stopIndex, windowIndex) {
            this.reel.getStopWindow(stopIndex, this.stopWindow);
            var isClump = false;
            if (windowIndex > 0 && windowIndex < this.symbolWindow.length) {
                isClump = (this.stopWindow[windowIndex] == this.reel.getStrip().getClumpSymbol());
            }
            return isClump;
        };
        /**
         * Find the first visible window index that is the start of a clump
         */
        Layout.prototype.getClumpIndex = function () {
            var index = 0;
            var clumpId = this.reel.getStrip().getClumpSymbol();
            for (var i = 1; i < this.symbolWindow.length - 1; ++i) {
                var symbolId = this.symbolWindow[i];
                if (symbolId == clumpId) {
                    index = i;
                    break;
                }
            }
            return index;
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
                    var image = this.symbols[i].getImage();
                    image.setSpriteSheet(this.symbolSet.spriteSheet);
                }
            }
        };
        return Layout;
    })();
    exports.Layout = Layout;
    /**
     * Controller for running pulse animation for a win
     * @class reels.PulseDisplay
     * @classdesc Controller for running pulse animation for a win
     */
    var PulseDisplay = (function () {
        /**
         * @constructor
         */
        function PulseDisplay(animComponents, layouts, symbolMap, symbolAnimations, symbolSheet) {
            this.animComponents = animComponents;
            this.layouts = layouts;
            this.symbolMap = symbolMap;
            this.symbolSheet = symbolSheet;
            this.symbolAnimations = symbolAnimations;
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
                var shadowActor = this.animComponents[reelNumber][reelPosition].shadow;
                var symbolCoverActor = this.animComponents[reelNumber][reelPosition].symbolCover;
                var shadowXfm = shadowActor.getTransform();
                var symbolCoverXfm = symbolCoverActor.getTransform();
                var yPos = layout.getSymbolPosition(reelPosition + 1) + anchorXfm.getPositionY();
                shadowXfm.setPositionY(yPos);
                shadowXfm.setVisible(true);
                symbolCoverXfm.setPositionY(yPos);
                symbolCoverXfm.setVisible(true);
                timeline.add(this.pulseSymbol(highlight, symbolId, anchorXfm.getPositionX(), yPos, duration), "pulse");
                timeline.add(TweenMax.fromTo(shadowXfm, duration, {
                    setPositionX: anchorXfm.getPositionX(),
                    setPositionY: yPos,
                    setScaleX: this.shadowAnimProps.scaleFactorStart,
                    setScaleY: this.shadowAnimProps.scaleFactorStart
                }, {
                    setPositionX: "+=" + this.shadowAnimProps.moveDistance,
                    setPositionY: "+=" + this.shadowAnimProps.moveDistance,
                    setScaleX: this.shadowAnimProps.scaleFactorEnd,
                    setScaleY: this.shadowAnimProps.scaleFactorEnd,
                    ease: Sine.easeInOut
                }).repeat(1).yoyo(true), "pulse");
                timelines.push(timeline);
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
                    var shadowXfm = this.animComponents[i][j].shadow.getTransform();
                    var symbolCoverXfm = this.animComponents[i][j].symbolCover.getTransform();
                    xfm.setVisible(false);
                    shadowXfm.setVisible(false);
                    symbolCoverXfm.setVisible(false);
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
            if (props.moveDistance != null) {
                this.shadowAnimProps.moveDistance = props.moveDistance;
            }
            if (props.scaleFactorStart != null) {
                this.shadowAnimProps.scaleFactorStart = props.scaleFactorStart;
            }
            if (props.scaleFactorEnd != null) {
                this.shadowAnimProps.scaleFactorEnd = props.scaleFactorEnd;
            }
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
            var symbolPos = yPos;
            var symbolMoveDistance = 25;
            var animationFound = false;
            xfm.setScale(1, 1);
            for (var customAnim = 0; customAnim < this.customAnimations.length; ++customAnim) {
                var customSymbolAnim = this.customAnimations[customAnim];
                if (customSymbolAnim.symbolId == symbolId && customSymbolAnim.validReel == symbolOffset.reelnumber) {
                    animationFound = true;
                    symbolPos += customSymbolAnim.xOffset;
                    if (customSymbolAnim.spriteSheet.getFrameCount() > 0) {
                        image.setSpriteSheet(customSymbolAnim.spriteSheet);
                        actor.getFrameAnimator().play();
                    }
                    else {
                        image.setSpriteSheet(this.symbolSheet);
                        image.setFrame(this.symbolMap[symbolId]);
                    }
                    break;
                }
            }
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
            xfm.setPositionY(symbolPos);
            xfm.setVisible(true);
            return TweenMax.fromTo(xfm, duration, {
                setPositionX: xPos,
                setPositionY: symbolPos
            }, {
                setPositionX: "-=" + symbolMoveDistance,
                setPositionY: "-=" + symbolMoveDistance,
                ease: Sine.easeInOut
            }).repeat(1).yoyo(true);
        };
        return PulseDisplay;
    })();
    exports.PulseDisplay = PulseDisplay;
    /**
     * Describes a set of reel symbols.
     */
    var SymbolSet = (function () {
        /**
         * Create a new SymbolSet object
         *
         * @param  mapping    mapping of symbol Ids (index) to image frames (value)
         * @param  spriteSheet  SpriteSheet to use for symbols
         */
        function SymbolSet(mapping, spriteSheet) {
            this.symbols = mapping;
            this.spriteSheet = spriteSheet;
        }
        /**
         * Get the frame id based on a symbol id
         *
         * @param  symbolId  the zero based symbol id
         */
        SymbolSet.prototype.getSymbol = function (symbolId) {
            return this.symbols[symbolId];
        };
        return SymbolSet;
    })();
    exports.SymbolSet = SymbolSet;
});
