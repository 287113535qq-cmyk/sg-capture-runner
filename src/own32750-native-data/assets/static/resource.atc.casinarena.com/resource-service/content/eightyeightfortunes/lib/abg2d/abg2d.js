define(["require", "exports", "TweenLite", "TweenMax"], function (require, exports, TweenLite, TweenMax) {
    /**
     * @file CanvasRenderer.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Used to render graphics to a Canvas
     */
    var CanvasRenderer = (function () {
        /**
         * Create a CanvasRenderer object
         *
         * @param  canvas  canvas for this renderer to render to
         */
        function CanvasRenderer(canvas) {
            this.canvas = canvas;
            this.opacity = 1;
            this.blendMode = 'source-over';
            this.strokeColor = '#000000';
            this.fillColor = '#000000';
            this.lineWidth = 1;
            this.descRefTracker = 0;
            this.rectDescTracker = 0;
            this.imageDescTracker = 0;
            this.textureMapDescTracker = 0;
            this.descPool = [[], [], []];
            this.descRefPool = new Array();
            this.mathUtil = new MathUtil();
        }
        /**
         * Set the profiler for rutime debugging
         *
         * @param  profiler  profiler object
         */
        CanvasRenderer.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
            var rectangleDescriptorCount = this.descPool[CanvasRenderer.RECT_DESC].length;
            for (var i = 0; i < rectangleDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.RECT_DESC][i].setProfiler(profiler);
            }
            var imageDescriptorCount = this.descPool[CanvasRenderer.IMAGE_DESC].length;
            for (var i = 0; i < imageDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.IMAGE_DESC][i].setProfiler(profiler);
            }
            var textureMapDescriptorCount = this.descPool[CanvasRenderer.TEXTURE_MAP_DESC].length;
            for (var i = 0; i < textureMapDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.TEXTURE_MAP_DESC][i].setProfiler(profiler);
            }
            this.profiler.strikeAccumulatedProfile('TextureMapDescriptor.render');
            this.profiler.strikeAccumulatedProfile('ImageDescriptor.render');
            this.profiler.strikeAccumulatedProfile('RectangleDescriptor.render');
        };
        /**
         * Call to initialize the render pools. Render pools must be initialized to use the
         * renderer.
         *
         * @param  rectangleDescriptorCount  the amount of rectangle descriptors
         * @param  imageDescriptorCount  the amount of image descriptors
         */
        CanvasRenderer.prototype.initialize = function (rectangleDescriptorCount, imageDescriptorCount) {
            var totalDescriptors = rectangleDescriptorCount + imageDescriptorCount;
            for (var i = 0; i < rectangleDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.RECT_DESC].push(new RectangleDescriptor());
            }
            for (var i = 0; i < imageDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.IMAGE_DESC].push(new ImageDescriptor());
            }
            for (var i = 0; i < imageDescriptorCount; ++i) {
                this.descPool[CanvasRenderer.TEXTURE_MAP_DESC].push(new TextureMapDescriptor());
            }
            for (var i = 0; i < totalDescriptors; ++i) {
                this.descRefPool.push([0, 0]);
            }
        };
        /**
         * Clears the current canvas for the next rendering frame.
         */
        CanvasRenderer.prototype.clear = function () {
            this.canvas.setTransform(1, 0, 0, 1, 0, 0);
            this.canvas.clear();
            return this;
        };
        /**
         * Clears the current rendering cache. Resets all the render bins
         */
        CanvasRenderer.prototype.clearCache = function () {
            for (var i = 0; i < this.descRefTracker; ++i) {
                var poolId = this.descRefPool[i][0];
                var index = this.descRefPool[i][1];
                this.descPool[poolId][index].resetDefaults();
            }
            this.descRefTracker = 0;
            this.rectDescTracker = 0;
            this.imageDescTracker = 0;
            this.textureMapDescTracker = 0;
        };
        /**
         * Flushes all current draw operations in the renderer.
         */
        CanvasRenderer.prototype.flush = function () {
            if (this.profiler != undefined) {
                this.profiler.setValue('CanvasRenderer.flush.RECTS', this.rectDescTracker);
                this.profiler.setValue('CanvasRenderer.flush.IMAGES', this.imageDescTracker);
                this.profiler.setValue('CanvasRenderer.flush.TEXTUREMAPS', this.textureMapDescTracker);
                this.profiler.resetAccumulatedTime('TextureMapDescriptor.render');
                this.profiler.resetAccumulatedTime('ImageDescriptor.render');
                this.profiler.resetAccumulatedTime('RectangleDescriptor.render');
            }
            for (var i = 0; i < this.descRefTracker; ++i) {
                var poolId = this.descRefPool[i][0];
                var index = this.descRefPool[i][1];
                var renderDescriptor = this.descPool[poolId][index];
                this.prepareDescriptor(renderDescriptor);
                renderDescriptor.render(this);
                renderDescriptor.resetDefaults();
            }
            this.descRefTracker = 0;
            this.rectDescTracker = 0;
            this.imageDescTracker = 0;
            this.textureMapDescTracker = 0;
            return this;
        };
        /**
         * Get the canvas this renderer references
         */
        CanvasRenderer.prototype.getCanvas = function () {
            return this.canvas;
        };
        /**
         * Get the number of render descriptors in the render cache
         */
        CanvasRenderer.prototype.getRenderCacheCount = function () {
            return this.descRefTracker;
        };
        /**
         * Update the current opacity on the canvas
         *
         * @param  opacity  rendering opacity [0..1]
         */
        CanvasRenderer.prototype.updateOpacity = function (opacity) {
            if (this.opacity != opacity) {
                this.opacity = opacity;
                this.canvas.setOpacity(this.opacity);
            }
        };
        /**
         * Update the current blend mode on the canvas
         *
         * @param  mode  rendering blend mode
         */
        CanvasRenderer.prototype.updateBlendMode = function (mode) {
            if (this.blendMode != mode) {
                this.blendMode = mode;
                this.canvas.setBlendMode(this.blendMode);
            }
        };
        /**
         * Update the current stroke style on the canvas
         *
         * @param  strokeColor  CSS color of the stroke
         */
        CanvasRenderer.prototype.updateStroke = function (strokeColor) {
            if (this.strokeColor != strokeColor) {
                this.strokeColor = strokeColor;
                this.canvas.setStrokeStyle(this.strokeColor);
            }
        };
        /**
         * Update the current fill style on the canvas
         *
         * @param  fillColor  CSS color of the fill
         */
        CanvasRenderer.prototype.updateFill = function (fillColor) {
            if (this.fillColor != fillColor) {
                this.fillColor = fillColor;
                this.canvas.setFillStyle(this.fillColor);
            }
        };
        /**
         * Update the line width on the canvas
         *
         * @param  lineWidth  line width in pixels
         */
        CanvasRenderer.prototype.updateLineWidth = function (lineWidth) {
            if (this.lineWidth != lineWidth) {
                this.lineWidth = lineWidth;
                this.canvas.setLineWidth(this.lineWidth);
            }
        };
        /**
         * Draw a rectangle to the canvas
         *
         * @param  mtx  rect transform
         * @param  w  rect width
         * @param  h  rect height
         * @param  color  color of rectangle
         * @param  opacity  level from 0..1
         * @param  lineWidth  width of line
         * @param  fill  true if rect should be filled
         * @param  blendMode  the globalCompositeOperation string
         */
        CanvasRenderer.prototype.drawRectangle = function (mtx, w, h, color, opacity, lineWidth, fill, blendMode) {
            var rectangleDescriptor = this.descPool[CanvasRenderer.RECT_DESC][this.rectDescTracker];
            this.descRefPool[this.descRefTracker][0] = CanvasRenderer.RECT_DESC;
            this.descRefPool[this.descRefTracker][1] = this.rectDescTracker++;
            this.descRefTracker++;
            rectangleDescriptor.opacity = opacity;
            rectangleDescriptor.fill = fill;
            rectangleDescriptor.color = color;
            rectangleDescriptor.lineWidth = lineWidth;
            rectangleDescriptor.width = w;
            rectangleDescriptor.height = h;
            rectangleDescriptor.mtx.setFrom(mtx);
            if (blendMode != undefined) {
                rectangleDescriptor.blendMode = blendMode;
            }
            return this;
        };
        /**
         * Draw an image
         *
         * @param  mtx  image transform
         * @param  img  image to draw
         * @param  srcx  source x coord
         * @param  srcy  source y coord
         * @param  srcw  source width
         * @param  srch  source height
         * @param  destw  destination width
         * @param  desth  destination height
         * @param  opacity  opacity level to draw image at 0..1
         * @param  snapToPixel  true if pixel snapping should be used
         * @param  blendMode  the globalCompositeOperation string
         */
        CanvasRenderer.prototype.drawImage = function (mtx, img, srcx, srcy, srcw, srch, destw, desth, opacity, snapToPixel, blendMode) {
            var imageDescriptor = this.descPool[CanvasRenderer.IMAGE_DESC][this.imageDescTracker];
            this.descRefPool[this.descRefTracker][0] = CanvasRenderer.IMAGE_DESC;
            this.descRefPool[this.descRefTracker][1] = this.imageDescTracker++;
            this.descRefTracker++;
            imageDescriptor.opacity = opacity;
            imageDescriptor.pixelSnap = snapToPixel;
            imageDescriptor.sourceX = srcx;
            imageDescriptor.sourceY = srcy;
            imageDescriptor.sourceWidth = srcw;
            imageDescriptor.sourceHeight = srch;
            imageDescriptor.destWidth = destw;
            imageDescriptor.destHeight = desth;
            imageDescriptor.image = img;
            imageDescriptor.mtx.setFrom(mtx);
            if (blendMode != undefined) {
                imageDescriptor.blendMode = blendMode;
            }
            return this;
        };
        CanvasRenderer.prototype.drawTextureMap = function (mtx, img, pts, opacity, snapToPixel, blendMode) {
            var textureDescriptor = this.descPool[CanvasRenderer.TEXTURE_MAP_DESC][this.textureMapDescTracker];
            this.descRefPool[this.descRefTracker][0] = CanvasRenderer.TEXTURE_MAP_DESC;
            this.descRefPool[this.descRefTracker][1] = this.textureMapDescTracker++;
            this.descRefTracker++;
            textureDescriptor.opacity = opacity;
            textureDescriptor.pixelSnap = snapToPixel;
            textureDescriptor.pts = pts;
            textureDescriptor.image = img;
            textureDescriptor.mtx.setFrom(mtx);
            if (blendMode != undefined) {
                textureDescriptor.blendMode = blendMode;
            }
            return this;
        };
        /**
         * Prepares the common aspects of the canvas for a render
         *
         * @param  descriptor  render descriptor to prepare with
         */
        CanvasRenderer.prototype.prepareDescriptor = function (descriptor) {
            var mtx = descriptor.getTransform();
            if (descriptor.snapToPixel()) {
                this.canvas.setTransform(mtx.m11, mtx.m12, mtx.m21, mtx.m22, this.mathUtil.roundP(mtx.tx), this.mathUtil.roundP(mtx.ty));
            }
            else {
                this.canvas.setTransform(mtx.m11, mtx.m12, mtx.m21, mtx.m22, mtx.tx, mtx.ty);
            }
        };
        /** Render descriptor Ids */
        CanvasRenderer.RECT_DESC = 0;
        /** Render descriptor Ids */
        CanvasRenderer.IMAGE_DESC = 1;
        /** Render descriptor Ids */
        CanvasRenderer.TEXTURE_MAP_DESC = 2;
        return CanvasRenderer;
    })();
    exports.CanvasRenderer = CanvasRenderer;
    var ImageSequence = (function () {
        function ImageSequence(actor) {
            this.actor = actor;
            this.transform = actor.getTransform();
            this.sheets = null;
            this.frame = 0;
            this.visible = true;
            this.opacity = 1;
            this.zoom = 1;
            this.renderTransform = new Matrix2d();
            this.renderParams = [];
            this.drawBrighter = false;
            this.horzAlign = 0 /* Left */;
            this.vertAlign = 0 /* Top */;
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        ImageSequence.prototype.setSpriteSheets = function (sheets) {
            this.sheets = sheets;
        };
        ImageSequence.prototype.getSpriteSheets = function () {
            return this.sheets;
        };
        // IComponent
        ImageSequence.prototype.getActor = function () {
            return this.actor;
        };
        ImageSequence.prototype.getName = function () {
            return exports.Components.ImageSequence;
        };
        ImageSequence.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        ImageSequence.prototype.getVisible = function () {
            return this.visible;
        };
        ImageSequence.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
        };
        ImageSequence.prototype.getOpacity = function () {
            return this.opacity;
        };
        ImageSequence.prototype.setDrawBrighter = function (on) {
            this.drawBrighter = on;
        };
        ImageSequence.prototype.setZoom = function (zoom) {
            this.zoom = zoom;
        };
        ImageSequence.prototype.getZoom = function () {
            return this.zoom;
        };
        ImageSequence.prototype.setClipRect = function (x, y, width, height) {
            this.clipRect = [x, y, width, height];
        };
        ImageSequence.prototype.getClipRect = function () {
            return this.clipRect;
        };
        ImageSequence.prototype.setFrame = function (frame) {
            this.frame = frame;
        };
        ImageSequence.prototype.getFrame = function () {
            return this.frame;
        };
        ImageSequence.prototype.getFrameCount = function () {
            return (this.sheets == null) ? 0 : this.sheets.length;
        };
        ImageSequence.prototype.getRenderTransform = function () {
            return this.renderTransform;
        };
        // IRenderable
        ImageSequence.prototype.render = function (cr) {
            if (this.sheets == null || this.opacity == 0) {
                return;
            }
            var sheetFrame = this.sheets[this.frame].getFrame(0);
            if (sheetFrame == null) {
                return;
            }
            this.renderTransform.setFrom(this.transform.getXfm());
            this.renderParams[0] = sheetFrame.x;
            this.renderParams[1] = sheetFrame.y;
            this.renderParams[2] = sheetFrame.drawW;
            this.renderParams[3] = sheetFrame.drawH;
            this.renderParams[4] = sheetFrame.drawW;
            this.renderParams[5] = sheetFrame.drawH;
            this.handleSheetRotation(sheetFrame);
            this.handleZoom();
            if (this.handleClip()) {
                var blendMode = (this.drawBrighter ? 'lighter' : 'source-over');
                cr.drawImage(this.renderTransform, this.sheets[this.frame].getResource(), this.renderParams[0], this.renderParams[1], this.renderParams[2], this.renderParams[3], this.renderParams[4], this.renderParams[5], this.opacity, false, blendMode);
            }
        };
        ImageSequence.prototype.setAlign = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(2 /* Center */);
                    break;
            }
        };
        ImageSequence.prototype.setHorizontalAlign = function (horizontal) {
            this.horzAlign = horizontal;
            switch (horizontal) {
                case 0 /* Left */:
                    {
                        this.transform.setPivotX(0);
                    }
                    break;
                case 1 /* Right */:
                    {
                        this.transform.setPivotX(this.getDrawWidth());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotX(Math.floor(this.getDrawWidth() / 2));
                    }
                    break;
            }
        };
        ImageSequence.prototype.setVerticalAlign = function (vertical) {
            this.vertAlign = vertical;
            switch (vertical) {
                case 0 /* Top */:
                    {
                        this.transform.setPivotY(0);
                    }
                    break;
                case 1 /* Bottom */:
                    {
                        this.transform.setPivotY(this.getDrawHeight());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotY(Math.floor(this.getDrawHeight() / 2));
                    }
                    break;
            }
        };
        ImageSequence.prototype.alignToParent = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.alignToParentX(0 /* Left */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.alignToParentX(1 /* Right */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.alignToParentX(1 /* Right */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.alignToParentX(0 /* Left */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(2 /* Center */);
                    break;
            }
        };
        ImageSequence.prototype.alignToParentX = function (horizontal) {
            var parent = this.transform.getParent();
            if (parent == null) {
                return;
            }
            var renderable = parent.getActor().getRenderable();
            if (renderable == undefined) {
                return;
            }
            switch (horizontal) {
                case 0 /* Left */:
                    {
                        this.transform.setPositionX(0);
                    }
                    break;
                case 1 /* Right */:
                    {
                        this.transform.setPositionX(renderable.getWidth());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPositionX(renderable.getWidth() / 2);
                    }
                    break;
            }
        };
        ImageSequence.prototype.alignToParentY = function (vertical) {
            var parent = this.transform.getParent();
            if (parent == null) {
                return;
            }
            var renderable = parent.getActor().getRenderable();
            if (renderable == undefined) {
                return;
            }
            switch (vertical) {
                case 0 /* Top */:
                    {
                        this.transform.setPositionY(0);
                    }
                    break;
                case 1 /* Bottom */:
                    {
                        this.transform.setPositionY(renderable.getHeight());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPositionY(renderable.getHeight() / 2);
                    }
                    break;
            }
        };
        ImageSequence.prototype.handleSheetRotation = function (sheetFrame) {
            if (sheetFrame.rotation != 0) {
                var hw = sheetFrame.drawW * 0.5;
                var hh = sheetFrame.drawH * 0.5;
                this.renderTransform.identity().appendMatrix(this.transform.getXfm()).appendTransform(hh, hw, 1, 1, -sheetFrame.rotation, 0, 0, hw, hh);
            }
        };
        ImageSequence.prototype.handleZoom = function () {
            // Only supports zooming in because zooming out would bleed pixels from other frames
            if (this.zoom > 1) {
                var diffx = (this.renderParams[2] - this.renderParams[2] / this.zoom);
                var diffy = (this.renderParams[3] - this.renderParams[3] / this.zoom);
                this.renderParams[0] += diffx * 0.5;
                this.renderParams[1] += diffy * 0.5;
                this.renderParams[2] -= diffx;
                this.renderParams[3] -= diffy;
            }
        };
        ImageSequence.prototype.handleClip = function () {
            var draw = true;
            if (this.clipRect != undefined) {
                if (((this.renderTransform.ty + this.renderParams[5]) <= this.clipRect[1]) || (this.renderTransform.ty >= (this.clipRect[1] + this.clipRect[3]))) {
                    draw = false;
                }
                else if (((this.renderTransform.tx + this.renderParams[4]) <= this.clipRect[0]) || (this.renderTransform.tx >= (this.clipRect[0] + this.clipRect[2]))) {
                    draw = false;
                }
                if (draw) {
                    if (this.renderTransform.tx < this.clipRect[0]) {
                        var dx = this.clipRect[0] - this.renderTransform.tx;
                        this.renderTransform.tx += dx;
                        this.renderParams[0] += dx;
                        this.renderParams[2] -= dx;
                        this.renderParams[4] -= dx;
                    }
                    else if ((this.renderTransform.tx + this.renderParams[4]) > (this.clipRect[0] + this.clipRect[2])) {
                        var dx = (this.clipRect[0] + this.clipRect[2]) - (this.renderTransform.tx + this.renderParams[4]);
                        this.renderParams[2] += dx;
                        this.renderParams[4] += dx;
                    }
                    if (this.renderTransform.ty < this.clipRect[1]) {
                        var dy = this.clipRect[1] - this.renderTransform.ty;
                        this.renderTransform.ty += dy;
                        this.renderParams[1] += dy;
                        this.renderParams[3] -= dy;
                        this.renderParams[5] -= dy;
                    }
                    else if ((this.renderTransform.ty + this.renderParams[5]) > (this.clipRect[1] + this.clipRect[3])) {
                        var dy = (this.clipRect[1] + this.clipRect[3]) - (this.renderTransform.ty + this.renderParams[5]);
                        this.renderParams[5] += dy;
                        this.renderParams[3] += dy;
                    }
                }
            }
            return draw;
        };
        ImageSequence.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        ImageSequence.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        ImageSequence.prototype.getWidth = function (frame) {
            var result = 0;
            if (this.sheets != null) {
                var f = this.sheets[(frame == undefined) ? this.frame : frame].getFrame(0);
                if (f != null) {
                    result = f.w;
                }
            }
            return result;
        };
        ImageSequence.prototype.getHeight = function (frame) {
            var result = 0;
            if (this.sheets != null) {
                var f = this.sheets[(frame == undefined) ? this.frame : frame].getFrame(0);
                if (f != null) {
                    result = f.h;
                }
            }
            return result;
        };
        ImageSequence.prototype.getDrawWidth = function (frame) {
            var result = 0;
            if (this.sheets != null) {
                var f = this.sheets[(frame == undefined) ? this.frame : frame].getFrame(0);
                if (f != null) {
                    result = f.drawW;
                }
            }
            return result;
        };
        /**
         * Get the actual size of the image
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        ImageSequence.prototype.getDrawHeight = function (frame) {
            var result = 0;
            if (this.sheets != null) {
                var f = this.sheets[(frame == undefined) ? this.frame : frame].getFrame(0);
                if (f != null) {
                    result = f.drawH;
                }
            }
            return result;
        };
        ImageSequence.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(this.frame), this.getHeight(this.frame));
            switch (this.horzAlign) {
                case 2 /* Center */:
                    bounds.move(-this.getWidth(this.frame) * 0.5, 0);
                    break;
                case 1 /* Right */:
                    bounds.move(-this.getWidth(this.frame), 0);
                    break;
            }
            switch (this.vertAlign) {
                case 2 /* Center */:
                    bounds.move(0, -this.getHeight(this.frame) * 0.5);
                    break;
                case 1 /* Bottom */:
                    bounds.move(0, -this.getHeight(this.frame));
                    break;
            }
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        ImageSequence.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(this.frame), this.getDrawHeight(this.frame));
            switch (this.horzAlign) {
                case 2 /* Center */:
                    bounds.move(-this.getDrawWidth(this.frame) * 0.5, 0);
                    break;
                case 1 /* Right */:
                    bounds.move(-this.getDrawWidth(this.frame), 0);
                    break;
            }
            switch (this.vertAlign) {
                case 2 /* Center */:
                    bounds.move(0, -this.getDrawHeight(this.frame) * 0.5);
                    break;
                case 1 /* Bottom */:
                    bounds.move(0, -this.getDrawHeight(this.frame));
                    break;
            }
        };
        return ImageSequence;
    })();
    exports.ImageSequence = ImageSequence;
    /**
     * @file MathUtil.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Utility class containing math functionality
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
    exports.MathUtil = MathUtil;
    /**
     * Component to handle rendering particles
     */
    var ParticleSystem = (function () {
        /**
         * Create a new Image object
         *
         * @param  actor  actor that owns the component
         * @param  transform  Transform component needed during runtime
         * @param  maxParticleCount  the max number of particles in the system
         */
        function ParticleSystem(actor, transform, maxParticleCount) {
            var _this = this;
            /** The scale of x */
            this.scaleX = 1;
            /** The scale of y */
            this.scaleY = 1;
            this.onBirth = function () {
            };
            this.mathUtil = new MathUtil();
            this.actor = actor;
            this.transform = transform;
            this.inactiveParticles = this.createPool(maxParticleCount);
            this.lastUpdate = 0;
            this.activeCount = 0;
            this.framerate = 0;
            this.randomFrame = false;
            this.defaultFrame = 0;
            this.drawBrighter = false;
            this.gravity = 0;
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
            TweenLite.ticker.addEventListener("tick", function (p) { return _this.update(p); }, this, true, 2);
        }
        /**
         * Set the global birth callback
         *
         * @param  func  the function to call when a particle is emitted
         */
        ParticleSystem.prototype.setOnBirth = function (func) {
            this.onBirth = func;
        };
        /**
         * Set the SpriteSheets to use when rendering
         *
         * @param  sheets  SpriteSheets to use
         */
        ParticleSystem.prototype.setSpriteSheets = function (sheets) {
            this.sheets = sheets;
        };
        /**
         * Get the SpriteSheet to use when rendering
         *
         * @param  id  the sheet id
         */
        ParticleSystem.prototype.getSpriteSheet = function (id) {
            return this.sheets[id];
        };
        /**
         * Get the SpriteSheet count
         */
        ParticleSystem.prototype.getSheetCount = function () {
            var count = 0;
            if (this.sheets != undefined) {
                count = this.sheets.length;
            }
            return count;
        };
        /**
         * Set the framerate for framed animations
         *
         * @param  rate  the framerate
         */
        ParticleSystem.prototype.setFramerate = function (rate) {
            this.framerate = rate;
        };
        /**
         * Set if a random frame will be generated at birth
         *
         * @param  randFrame  true to choose a random frame at birth
         */
        ParticleSystem.prototype.setRandomStartFrame = function (randFrame) {
            this.randomFrame = randFrame;
        };
        /**
         * Set the frame to start with if not random
         *
         * @param  frame  the start frame
         */
        ParticleSystem.prototype.setDefaultFrame = function (frame) {
            this.defaultFrame = frame;
        };
        /**
         * Set the target opacity
         *
         * @param  target  the target value
         */
        ParticleSystem.prototype.setTargetOpacity = function (target, easeMode, repeat, yoyo) {
            this.targetOpacity = {
                value: target,
                easeMode: (easeMode != undefined ? easeMode : Linear.easeNone),
                repeat: (repeat != undefined ? repeat : 0),
                yoyo: (yoyo != undefined ? yoyo : true)
            };
        };
        /**
         * Set the bright drawing mode
         *
         * @param  on  true to draw brighter particles
         */
        ParticleSystem.prototype.setDrawBrighter = function (on) {
            this.drawBrighter = on;
        };
        /**
         * Set gravity acceleration
         *
         * @param  gravity  gravity acceleration
         */
        ParticleSystem.prototype.setGravity = function (gravity) {
            this.gravity = gravity;
        };
        /**
         * Check the visibility of the renderable
         */
        ParticleSystem.prototype.isVisible = function () {
            return this.transform.isVisible();
        };
        /**
         * Get the z rendering order of the renderable
         */
        ParticleSystem.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Get the original width of the image being rendered
         */
        ParticleSystem.prototype.getWidth = function () {
            //Not implemented
            return 0;
        };
        /**
         * Get the original height of the image being rendered
         */
        ParticleSystem.prototype.getHeight = function () {
            //Not implemented
            return 0;
        };
        /**
         * Get the actual size of the image
         */
        ParticleSystem.prototype.getDrawWidth = function () {
            //Not implemented
            return 0;
        };
        /**
         * Get the actual size of the image
         */
        ParticleSystem.prototype.getDrawHeight = function () {
            //Not implemented
            return 0;
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        ParticleSystem.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(), this.getHeight());
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        ParticleSystem.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(), this.getDrawHeight());
        };
        /**
         * Get the actor who owns the component
         */
        ParticleSystem.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        ParticleSystem.prototype.getName = function () {
            return exports.Components.ParticleSystem;
        };
        /**
         * Get the active particle count
         */
        ParticleSystem.prototype.getParticleCount = function () {
            return this.activeCount;
        };
        /**
         * Clear all the living particles
         */
        ParticleSystem.prototype.clear = function () {
            while (this.activeCount > 0) {
                this.killParticle(this.activeParticles);
            }
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        ParticleSystem.prototype.render = function (cr) {
            //Early out
            var p = this.activeParticles;
            if (p == null)
                return;
            var transScale = this.transform.getTranslationScale();
            var pos = [0, 0];
            while (p != null) {
                this.scalePosition(p, pos);
                p.renderTransform.setFrom(this.transform.getXfm());
                var hw = 0;
                var hh = 0;
                var sheet = null;
                if (this.sheets != undefined) {
                    sheet = this.sheets[p.sheetId];
                    var sheetFrame = sheet.getFrame(Math.floor(p.frame));
                    hw = ((p.sizeX * sheetFrame.w) / 2) * transScale;
                    hh = ((p.sizeY * sheetFrame.h) / 2) * transScale;
                }
                else {
                    hw = (p.sizeX / 2) * transScale;
                    hh = (p.sizeY / 2) * transScale;
                }
                p.renderTransform.appendTransform(pos[0], pos[1], 1, 1, p.rotation, 0, 0, hw, hh);
                var blendMode = (this.drawBrighter ? "lighter" : "source-over");
                if (sheet != null) {
                    var sheetFrame = sheet.getFrame(Math.floor(p.frame));
                    var srcx = sheetFrame.x;
                    var srcy = sheetFrame.y;
                    var srcw = sheetFrame.drawW;
                    var srch = sheetFrame.drawH;
                    cr.drawImage(p.renderTransform, sheet.getResource(), srcx, srcy, srcw, srch, sheetFrame.drawW * p.sizeX, sheetFrame.drawH * p.sizeY, p.opacity, false, blendMode);
                }
                else {
                    cr.drawRectangle(p.renderTransform, p.sizeX * transScale, p.sizeY * transScale, p.color, p.opacity, 0, true, blendMode);
                }
                p = p.next;
            }
        };
        /**
         * Create some particles using current emitter settings
         *
         * @param  count  number of particles to emit
         * @param  onBirth  the function to call when each particle is emitted
         */
        ParticleSystem.prototype.emit = function (count, onBirth) {
            for (var i = 0; i < count; ++i) {
                var particle = this.activateParticle();
                if (particle != null) {
                    onBirth(particle);
                    this.onBirth(particle);
                    this.createPropertyAnimations(particle);
                }
                else {
                    break;
                }
            }
        };
        /**
         * Activate one particle from the pool. May return null if pool is empty.
         */
        ParticleSystem.prototype.activateParticle = function () {
            var particle = this.inactiveParticles;
            if (particle != null) {
                this.inactiveParticles = this.removeParticle(particle);
                this.activeParticles = this.insertParticle(particle, this.activeParticles);
                ++this.activeCount;
                this.resetDefaults(particle);
            }
            return particle;
        };
        /**
         * Kill the given particle
         *
         * @param  particle  the particle to kill
         */
        ParticleSystem.prototype.killParticle = function (particle) {
            TweenLite.killTweensOf(particle);
            this.activeParticles = this.removeParticle(particle);
            this.inactiveParticles = this.insertParticle(particle, this.inactiveParticles);
            --this.activeCount;
        };
        /**
         * Remove a particle from a list and return the front of the list
         *
         * @param  particle  the particle to remove
         */
        ParticleSystem.prototype.removeParticle = function (particle) {
            if (particle.prev != null) {
                particle.prev.next = particle.next;
            }
            if (particle.next != null) {
                particle.next.prev = particle.prev;
            }
            var front = particle.prev;
            if (front != null) {
                while (front.prev != null) {
                    front = front.prev;
                }
            }
            else {
                front = particle.next;
            }
            particle.next = null;
            particle.prev = null;
            return front;
        };
        /**
         * Insert particle before the given node and return the front of the list
         *
         * @param  particle  particle to insert
         * @param  next  insert particle before this node
         */
        ParticleSystem.prototype.insertParticle = function (particle, next) {
            particle.next = next;
            if (next != null) {
                particle.prev = next.prev;
                next.prev = particle;
            }
            else {
                particle.prev = null;
            }
            if (particle.prev != null) {
                particle.prev.next = particle;
            }
            var front = particle;
            while (front.prev != null) {
                front = front.prev;
            }
            return front;
        };
        /**
         * Create the particles and return the head of the linked list
         *
         * @param  count  the number of particles to create
         */
        ParticleSystem.prototype.createPool = function (count) {
            var first = null;
            for (var i = 0; i < count; ++i) {
                var next = first;
                first = {
                    time: 0,
                    positionX: 0,
                    positionY: 0,
                    velocityX: 0,
                    velocityY: 0,
                    rotation: 0,
                    rotationVelocity: 0,
                    sizeX: 0,
                    sizeY: 0,
                    color: "#000000",
                    opacity: 0,
                    frame: 0,
                    sheetId: 0,
                    renderTransform: this.transform.getXfm().clone(),
                    prev: null,
                    next: next
                };
                this.resetDefaults(first);
                if (next != null) {
                    next.prev = first;
                }
            }
            return first;
        };
        /**
         * Reset to the default starting values
         *
         * @param  particle  particle to reset
         */
        ParticleSystem.prototype.resetDefaults = function (particle) {
            particle.time = 1;
            particle.positionX = 0;
            particle.positionY = 0;
            particle.velocityX = 0;
            particle.velocityY = 0;
            particle.rotation = 0;
            particle.rotationVelocity = 0;
            particle.sizeX = this.scaleX;
            particle.sizeY = this.scaleY;
            particle.color = "#000000";
            particle.opacity = 1;
            particle.sheetId = 0;
            //if(this.sheets != undefined && this.sheets.length > 1)
            //{
            //    particle.sheetId = this.mathUtil.genRandRange(0, this.sheets.length - 1);
            //}
            particle.frame = this.defaultFrame;
            if (this.randomFrame && this.sheets != undefined) {
                particle.frame = this.mathUtil.genRandRange(0, this.sheets[particle.sheetId].getFrameCount() - 1);
            }
        };
        /**
         * Update the simulation
         */
        ParticleSystem.prototype.update = function (e) {
            //Elapsed time
            var t = e.target.time - this.lastUpdate;
            this.lastUpdate = e.target.time;
            //Early out
            if (this.activeParticles == null)
                return;
            var p = this.activeParticles;
            while (p != null) {
                //Update time remaining
                p.time -= t;
                if (p.time <= 0) {
                    var next = p.next;
                    this.killParticle(p);
                    p = next;
                    continue;
                }
                //Update velocity
                if (this.gravity != 0) {
                    p.velocityY += this.gravity * t;
                }
                //Update position
                if (p.velocityX != 0) {
                    p.positionX += p.velocityX * t;
                }
                if (p.velocityY != 0) {
                    p.positionY += p.velocityY * t;
                }
                //Update rotation
                if (p.rotationVelocity != 0) {
                    p.rotation += p.rotationVelocity * t;
                    if (p.rotation >= Math.abs(360)) {
                        p.rotation -= Math.floor(p.rotation / 360) * 360;
                    }
                }
                //Next particle
                p = p.next;
            }
        };
        /**
         * Create property animations to target values
         *
         * @param  particle  the particle to animate
         */
        ParticleSystem.prototype.createPropertyAnimations = function (particle) {
            var _this = this;
            //Time
            TweenLite.to(particle, particle.time, { time: 0, onComplete: function () { return _this.killParticle(particle); } });
            if (this.targetOpacity != undefined) {
                TweenMax.to(particle, particle.time / (1 + this.targetOpacity.repeat), {
                    opacity: this.targetOpacity.value,
                    ease: this.targetOpacity.easeMode,
                    repeat: this.targetOpacity.repeat,
                    yoyo: this.targetOpacity.yoyo
                });
            }
            if (this.framerate > 0 && this.sheets != undefined) {
                var sheet = this.sheets[particle.sheetId];
                if (sheet.getFrameCount() > 0) {
                    var endFrame = sheet.getFrameCount() - 1;
                    var animTime = endFrame * (1 / this.framerate);
                    var createFrameAnim = function () { return TweenMax.fromTo(particle, animTime, { frame: 0 }, { frame: endFrame - 1, repeat: -1, ease: Linear.easeNone }); };
                    //Start first cycle from current frame
                    var shortAnimTime = (endFrame - particle.frame) * (1 / this.framerate);
                    TweenMax.fromTo(particle, shortAnimTime, { frame: particle.frame }, { frame: endFrame - 1, ease: Linear.easeNone, onComplete: function () {
                        createFrameAnim();
                    } });
                }
            }
        };
        /**
         * Scale positions by translation scale
         */
        ParticleSystem.prototype.scalePosition = function (p, positionOut) {
            var x = p.positionX;
            var y = p.positionY;
            var transScale = this.transform.getTranslationScale();
            if (transScale != 1) {
                // We need to scale the positions based on the distance from the origin
                var theta = Math.atan2(y, x);
                var h = y / Math.sin(theta);
                var h1 = h * transScale;
                var x1 = h1 * Math.cos(theta);
                var y1 = h1 * Math.sin(theta);
                if (x == 0) {
                    y = Math.round(y * transScale);
                }
                else if (y == 0) {
                    x = Math.round(x * transScale);
                }
                else {
                    x = x1;
                    y = y1;
                }
            }
            positionOut[0] = x;
            positionOut[1] = y;
        };
        return ParticleSystem;
    })();
    exports.ParticleSystem = ParticleSystem;
    /**
     * @file Scene.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Represents a transformable collection of 2d renderable objects
     */
    var Scene = (function () {
        /**
         * Create a Scene object
         *
         * @param  renderer  the renderer to use for the scene
         * @param  translationScale  factor for translation scaling
         * @param  autoRefresh  true if you want scene to refresh itself
         */
        function Scene(renderer, translationScale, autoRefresh) {
            var _this = this;
            this.visible = true;
            this.renderer = renderer;
            this.actors = new Array();
            this.renderables = new Array();
            this.transforms = new Array();
            this.root = new Transform(null, null, this);
            this.translationScale = translationScale;
            this.renderBackToFront = true;
            this.needsSort = false;
            if (autoRefresh) {
                TweenLite.ticker.addEventListener('tick', function () { return _this.refresh(); }, this, false, 1);
            }
            this.createCanvasInspectionRoot();
        }
        /**
         * Set a profiler for debugging
         *
         * @param  profiler  timing profiler
         */
        Scene.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
            this.renderer.setProfiler(profiler);
        };
        /**
         * Set the visibility
         *
         * @param  visible  the visibility
         */
        Scene.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility
         */
        Scene.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the render order direction
         *
         * @param  backToFront   true if rendering should happen backToFront
         */
        Scene.prototype.setRenderBackToFront = function (backToFront) {
            this.renderBackToFront = backToFront;
        };
        /**
         * Call to set the scene sorting flag. Once set the scene will sort all the transforms
         * on the next update
         */
        Scene.prototype.sortScene = function () {
            this.needsSort = true;
        };
        /**
         * Add an actor to the scene
         *
         * @param  actor  actor to add to the scene
         */
        Scene.prototype.addActor = function (actor) {
            this.actors.push(actor);
        };
        /**
         * Remove an actor from the scene
         *
         * @param  actor  actor to remove from the scene
         */
        Scene.prototype.removeActor = function (actor) {
            this.actors.splice(this.actors.indexOf(actor), 1);
        };
        /**
         * Add renderable to the scene
         *
         * @param  renderable  renderable to add to the scene
         */
        Scene.prototype.addRenderable = function (renderable) {
            this.renderables.push(renderable);
            this.sortScene();
        };
        /**
         * Remove a renderable from the scene
         *
         * @param  renderable  renderable to remove from the scene
         */
        Scene.prototype.removeRenderable = function (renderable) {
            this.renderables.splice(this.renderables.indexOf(renderable), 1);
            this.sortScene();
        };
        /**
         * Add a transform to the scene graph
         *
         * @param  transform  transform to put into scene graph
         * @param  parent  parent transform
         */
        Scene.prototype.addTransform = function (transform, parent) {
            transform.setTranslationScale(this.translationScale);
            this.transforms.push(transform);
            this.insert(transform, parent);
            this.sortScene();
        };
        /**
         * Add a transform to the scene graph
         *
         * @param  transform  transform to put into scene graph
         * @param  parent  parent transform
         */
        Scene.prototype.removeTransform = function (transform) {
            this.transforms.splice(this.transforms.indexOf(transform, 0), 1);
            this.remove(transform);
            this.sortScene();
        };
        /**
         * Set the scaling factor on the translations on all transforms in the scene
         *
         * @param  scale  translation scale. If there is no scale then value should be 1.
         */
        Scene.prototype.setTranslationScale = function (scale) {
            this.translationScale = scale;
            for (var i = 0; i < this.transforms.length; ++i) {
                this.transforms[i].setTranslationScale(scale);
            }
        };
        /**
         * Call once a frame to update the scene
         */
        Scene.prototype.refresh = function () {
            var _this = this;
            this.renderer.clear();
            if (this.needsSort) {
                this.transforms.sort(function (a, b) { return _this.zSortXfms(a, b); });
                var tCnt = this.transforms.length;
                for (var i = 0; i < tCnt; ++i) {
                    this.transforms[i].setWorldZOrder(i + (this.renderBackToFront ? 0 : (tCnt - i - 1)));
                }
                this.renderables.sort(function (a, b) { return _this.checkRenderableLeaf(a, b); });
                this.needsSort = false;
            }
            this.root.doTransformPass();
            this.render();
            this.renderer.flush();
        };
        /**
         * Get the Canvas
         */
        Scene.prototype.getCanvas = function () {
            return this.renderer.getCanvas();
        };
        /**
         * Get the root node of the tree
         */
        Scene.prototype.getRoot = function () {
            return this.root;
        };
        /**
         * Get number of nodes in the tree
         */
        Scene.prototype.getNumNodes = function () {
            return this.root.getNumNodes();
        };
        /**
         * Get number of nodes in the tree
         */
        Scene.prototype.getNumLevels = function () {
            return this.root.getNumLevels();
        };
        /**
         * Insert a node into the tree
         *
         * @param  node  node to insert
         * @param  parent  node to parent to
         */
        Scene.prototype.insert = function (node, parent) {
            if (parent != null) {
                parent.addChild(node);
            }
            else {
                this.root.addChild(node);
            }
        };
        /**
         * Remove a node from the tree
         *
         * @param  node  node to remove
         */
        Scene.prototype.remove = function (node) {
            if (node.getParent() != null) {
                node.getParent().removeChild(node);
                node.orphan();
            }
        };
        /**
         * Call to draw the scene into all canvases that have been previously
         * set on the scene
         */
        Scene.prototype.render = function () {
            if (!this.visible)
                return;
            var rCnt = this.renderables.length;
            for (var i = 0; i < rCnt; ++i) {
                var r = this.renderables[i];
                if (r.isVisible()) {
                    r.render(this.renderer);
                }
            }
        };
        /**
         * Checks the z ordering of renderables
         *
         * @param  r1  first renderable
         * @param  r2  second renderable
         */
        Scene.prototype.checkRenderableLeaf = function (r1, r2) {
            var z1 = r1.getZOrder();
            var z2 = r2.getZOrder();
            return (z1 != z2) ? (z1 < z2 ? 1 : -1) : (r1 < r2 ? 1 : -1);
        };
        /**
         * Checks the z ordering of sibling xfms. If xfm1 z is
         * greater than xfm2 returns true else if xfm1 was created
         * after xfm2 returns true else returns false.
         *
         * @param  xfm1  first xfm
         * @param  xfm2  second xfm
         */
        Scene.prototype.checkTransformLeaf = function (x1, x2) {
            var z1 = x1.getZOrder();
            var z2 = x2.getZOrder();
            return (z1 != z2) ? (z1 < z2 ? 1 : -1) : (x1.getActor().getHandle() < x2.getActor().getHandle() ? 1 : -1);
        };
        /**
         * Sorts two xfms on z order. Uses 2d painters algorithm.
         *
         * @param    xfm1    first xfm
         * @param    xfm2    second xfm
         */
        Scene.prototype.zSortXfms = function (x1, x2) {
            // Siblings? Just check their z-values.
            if (x1.getParent() == x2.getParent())
                return this.checkTransformLeaf(x1, x2);
            // Find xfm1's ancestors. If xfm2 is among them, return true (xfm1 is above xfm2).
            var ancestors1 = new Array();
            var parent1 = x1;
            do {
                if (parent1 == x2)
                    return -1;
                ancestors1.unshift(parent1);
            } while ((parent1 = parent1.getParent()) != null);
            // Find xfm's ancestors. If xfm1 is among them, return false (xfm2 is above xfm1).
            var ancestors2 = new Array();
            var parent2 = x2;
            do {
                if (parent2 == x1)
                    return 1;
                ancestors2.unshift(parent2);
            } while ((parent2 = parent2.getParent()) != null);
            // Truncate the largest ancestor list.
            var size1 = ancestors1.length;
            var size2 = ancestors2.length;
            if (size1 > size2) {
                ancestors1.splice(size2, size1 - size2);
            }
            else if (size2 > size1) {
                ancestors2.splice(size1, size2 - size1);
            }
            var an1 = new Array();
            var an2 = new Array();
            an1 = an1.concat(ancestors1);
            an2 = an2.concat(ancestors2);
            // Compare items from the two ancestors lists and find a match. Then
            // compare xfm1's and xfm2's top levels relative to the common ancestor.
            var i = an1.length - 2;
            while (i >= 0) {
                var a1 = an1[i];
                var a2 = an2[i];
                if (a1 == a2)
                    return this.checkTransformLeaf(an1[i + 1], an2[i + 1]);
                --i;
            }
            // No common ancestor? Then just compare the items' top levels directly.
            return this.checkTransformLeaf(an1[0], an2[0]);
        };
        /**
         * Debugging function that creates a hidden DOM tree under the canvas HTML element,
         * which describes the transform graph.
         */
        Scene.prototype.createCanvasInspectionRoot = function () {
            var _this = this;
            var canvasElement = this.renderer.getCanvas().getCanvas();
            var accessRoot = document.createElement('div');
            accessRoot.setAttribute('id', 'canvas-inspection');
            canvasElement.appendChild(accessRoot);
            window.updateCanvasInspectionTree = function () {
                _this.updateCanvasInspectionTree();
            };
        };
        /**
         * Update the hidden DOM tree with any changes since the last update.
         */
        Scene.prototype.updateCanvasInspectionTree = function () {
            var canvasElement = this.renderer.getCanvas().getCanvas();
            var accessRoot = document.getElementById('canvas-inspection');
            while (accessRoot.firstChild) {
                accessRoot.removeChild(accessRoot.firstChild);
            }
            accessRoot.appendChild(this.createTransformInspectionDiv(this.root));
        };
        /**
         * Recursive function that creates DOM elements for a tree of Transform objects,
         * as used by updateCanvasInspectionTree().
         */
        Scene.prototype.createTransformInspectionDiv = function (transform) {
            var elem = document.createElement('div');
            elem.style.display = 'none';
            elem.setAttribute('class', 'canvas-inspection.' + transform.getName());
            // If we want to make this an actual accessibility thing, set the ARIA role attributes.
            // http://www.w3.org/html/wg/drafts/html/master/dom.html#allowed-aria-roles,-states-and-properties
            //elem.setAttribute('role', '');
            var actor = transform.getActor();
            if (actor != null) {
                // Actor attributes.
                elem.setAttribute('actor-handle', String(actor.getHandle()));
                elem.setAttribute('actor-name', String(actor.getName()));
                // Either of these can give us a bounding rect.
                if (actor.getImage() != null || actor.getBox() != null || actor.getVectorGraphics() != null || actor.getText() != null) {
                    var bounds = new Rect();
                    if (actor.getImage() != null) {
                        actor.getImage().getDrawBounds(bounds);
                    }
                    else if (actor.getBox() != null) {
                        actor.getBox().getDrawBounds(bounds);
                    }
                    else if (actor.getVectorGraphics() != null) {
                        actor.getVectorGraphics().getDrawBounds(bounds);
                    }
                    else {
                        actor.getText().getDrawBounds(bounds);
                        elem.setAttribute('actor-text', actor.getText().getText());
                    }
                    elem.setAttribute('bounds-drawx', String(bounds.x));
                    elem.setAttribute('bounds-drawy', String(bounds.y));
                    elem.setAttribute('bounds-drawwidth', String(bounds.width));
                    elem.setAttribute('bounds-drawheight', String(bounds.height));
                }
            }
            // A whole bunch of questionably-useful transform attributes.
            elem.setAttribute('transform-visible', String(transform.getVisible()));
            elem.setAttribute('transform-usetranslationscale', String(transform.getUseTranslationScale()));
            elem.setAttribute('transform-translationscale', String(transform.getTranslationScale()));
            elem.setAttribute('transform-zorder', String(transform.getZOrder()));
            elem.setAttribute('transform-worldzorder', String(transform.getWorldZOrder()));
            elem.setAttribute('transform-positionx', String(transform.getPositionX()));
            elem.setAttribute('transform-translatedpositionx', String(transform.getTranslatedPositionX()));
            elem.setAttribute('transform-positiony', String(transform.getPositionY()));
            elem.setAttribute('transform-translatedpositiony', String(transform.getTranslatedPositionY()));
            elem.setAttribute('transform-pivotx', String(transform.getPivotX()));
            elem.setAttribute('transform-pivoty', String(transform.getPivotY()));
            elem.setAttribute('transform-scalex', String(transform.getScaleX()));
            elem.setAttribute('transform-scaley', String(transform.getScaleY()));
            elem.setAttribute('transform-skewx', String(transform.getSkewX()));
            elem.setAttribute('transform-skewy', String(transform.getSkewY()));
            elem.setAttribute('transform-rotation', String(transform.getRotation()));
            // Walk the rest of the tree and append children.
            if (transform.getChild() != null) {
                var firstChild = transform.getChild();
                elem.appendChild(this.createTransformInspectionDiv(firstChild));
                var nextChild = firstChild.getSibling();
                while (nextChild != null && nextChild != firstChild) {
                    elem.appendChild(this.createTransformInspectionDiv(nextChild));
                    nextChild = nextChild.getSibling();
                }
            }
            return elem;
        };
        return Scene;
    })();
    exports.Scene = Scene;
    /**
     * @file Image.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Component to handle rendering 2d images
     */
    var TextureMap = (function () {
        function TextureMap(actor) {
            this.actor = actor;
            this.transform = actor.getTransform();
            this.visible = true;
            this.img = null;
            this.frame = 0;
            this.opacity = 1;
            this.zoom = 1;
            this.pts = null;
            this.renderTransform = new Matrix2d();
            this.renderParams = [];
            this.drawBrighter = false;
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        TextureMap.prototype.setRenderPoints = function (pts) {
            this.pts = pts;
        };
        /**
         * Set the visibility
         *
         * @param  visible  the visibility
         */
        TextureMap.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility
         */
        TextureMap.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the opacity
         *
         * @param  opacity  the opacity..[0..1]
         */
        TextureMap.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
        };
        /**
         * Get the opacity
         */
        TextureMap.prototype.getOpacity = function () {
            return this.opacity;
        };
        /**
         * Set the amount to scale source image within the drawing rect.
         * Until more support is needed, this will always scale relative
         * to the center of the current frame.
         * Only supports zooming in (zoom >= 1) because zooming out would
         * bleed pixels from other frames.
         *
         * @param  zoom  the zoom value
         */
        TextureMap.prototype.setZoom = function (zoom) {
            this.zoom = zoom;
        };
        /*
         * Get the zoom
         */
        TextureMap.prototype.getZoom = function () {
            return this.zoom;
        };
        TextureMap.prototype.setImg = function (img) {
            this.img = img;
        };
        TextureMap.prototype.getImg = function () {
            return this.img;
        };
        /**
         * Set the frame used to access a frame in the sprite when rendering
         *
         * @param  frame  frame to use in SpriteSheet. zero based.
         */
        TextureMap.prototype.setFrame = function (frame) {
            this.frame = frame;
        };
        /**
         * Get the current frame number that is being used
         */
        TextureMap.prototype.getFrame = function () {
            return this.frame;
        };
        /**
         * Set the bright drawing mode
         *
         * @param  on  true to draw brighter images
         */
        TextureMap.prototype.setDrawBrighter = function (on) {
            this.drawBrighter = on;
        };
        /**
         * Check the visibility of the renderable
         */
        TextureMap.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        /**
         * Get the z rendering order of the renderable
         */
        TextureMap.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Get the original width of the image being rendered
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        TextureMap.prototype.getWidth = function (frame) {
            var result = 0;
            return result;
        };
        /**
         * Get the original height of the image being rendered
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        TextureMap.prototype.getHeight = function (frame) {
            var result = 0;
            return result;
        };
        /**
         * Get the actual size of the image
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        TextureMap.prototype.getDrawWidth = function (frame) {
            var result = 0;
            return result;
        };
        /**
         * Get the actual size of the image
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        TextureMap.prototype.getDrawHeight = function (frame) {
            var result = 0;
            return result;
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        TextureMap.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(this.frame), this.getHeight(this.frame));
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        TextureMap.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(this.frame), this.getDrawHeight(this.frame));
        };
        /**
         * Get the transform used for rendering the image
         */
        TextureMap.prototype.getRenderTransform = function () {
            return this.renderTransform;
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        TextureMap.prototype.render = function (cr) {
            if (this.img == null || this.opacity == 0) {
                return;
            }
            this.renderTransform.setFrom(this.transform.getXfm());
            if (this.pts) {
                var blendMode = (this.drawBrighter ? 'lighter' : 'source-over');
                for (var i = 0; i < this.pts.length; i++) {
                    cr.drawTextureMap(this.renderTransform, this.img, this.pts[i], this.opacity, false, blendMode);
                }
            }
        };
        /**
         * Get the actor who owns the component
         */
        TextureMap.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        TextureMap.prototype.getName = function () {
            return exports.Components.TextureMap;
        };
        return TextureMap;
    })();
    exports.TextureMap = TextureMap;
    /**
     * @file SpriteSheetFrame.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Data object that contains info on a frame of a sprite sheet
     */
    var SpriteSheetFrame = (function () {
        /**
         * Create a SpriteSheetFrame object
         *
         * @param  frame  frame index
         * @param  page  page number
         * @param  name  string name
         * @param  x  x position
         * @param  y  y position
         * @param  w  frame width
         * @param  h  frame height
         * @param  dw  drawing frame width
         * @param  dh  drawing frame height
         * @param  r  rotated frame
         */
        function SpriteSheetFrame(frame, page, name, x, y, w, h, dw, dh, r) {
            this.frame = frame;
            this.page = page;
            this.name = name;
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.drawW = dw;
            this.drawH = dh;
            this.rotation = r ? 90 : 0;
        }
        return SpriteSheetFrame;
    })();
    exports.SpriteSheetFrame = SpriteSheetFrame;
    /**
     * @file Color.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Enumeration of basic colors
     */
    (function (Colors) {
        Colors[Colors["Black"] = 0] = "Black";
        Colors[Colors["White"] = 1] = "White";
        Colors[Colors["Red"] = 2] = "Red";
        Colors[Colors["Green"] = 3] = "Green";
        Colors[Colors["Blue"] = 4] = "Blue";
        Colors[Colors["WiBlue"] = 5] = "WiBlue";
        Colors[Colors["DarkBlue"] = 6] = "DarkBlue";
        Colors[Colors["PowderBlue"] = 7] = "PowderBlue";
        Colors[Colors["SkyBlue"] = 8] = "SkyBlue";
        Colors[Colors["Violet"] = 9] = "Violet";
        Colors[Colors["Yellow"] = 10] = "Yellow";
        Colors[Colors["Purple"] = 11] = "Purple";
        Colors[Colors["Orange"] = 12] = "Orange";
        Colors[Colors["Gray"] = 13] = "Gray";
        Colors[Colors["SlateGray"] = 14] = "SlateGray";
        Colors[Colors["Aqua"] = 15] = "Aqua";
        Colors[Colors["Beige"] = 16] = "Beige";
        Colors[Colors["Brown"] = 17] = "Brown";
        Colors[Colors["Tan"] = 18] = "Tan";
        Colors[Colors["Wheat"] = 19] = "Wheat";
        Colors[Colors["CornflowerBlue"] = 20] = "CornflowerBlue";
        Colors[Colors["LimeGreen"] = 21] = "LimeGreen";
        Colors[Colors["Magenta"] = 22] = "Magenta";
        Colors[Colors["Pink"] = 23] = "Pink";
        Colors[Colors["Silver"] = 24] = "Silver";
    })(exports.Colors || (exports.Colors = {}));
    var Colors = exports.Colors;
    /**
     * Represents a 32 bit, RGB color.
     */
    var Color = (function () {
        /**
         * Create a Color object
         *
         * @param  color  color enumeration to set. optional.
         * @param  alpha  alpha value from 0..1. optional.
         */
        function Color(color, alpha) {
            if (color === void 0) { color = 0 /* Black */; }
            if (alpha === void 0) { alpha = 1; }
            this.value = Color.getColor(color);
            this.alpha = alpha;
        }
        /**
         * Get a CSS compatible color string from RGB color values
         *
         * @param  r  red component (0 - 255)
         * @param  g  green component (0 - 255)
         * @param  b  Optional. blue component (0 - 255)
         * @param  a  Optional. The alpha component for the color where 0 is fully transparent and 1 is fully opaque.
         */
        Color.getRGB = function (r, g, b, a) {
            if ((r != undefined) && (b == undefined)) {
                a = g;
                b = (r >> 0) & 0xff;
                g = (r >> 8) & 0xff;
                r = (r >> 16) & 0xff;
            }
            if (a == undefined)
                return "rgb(" + r + "," + g + "," + b + ")";
            else
                return "rgba(" + r + "," + g + "," + b + "," + a + ")";
        };
        /**
         * Get a hex color string from RGB color values
         *
         * @param  r  red component (0 - 255)
         * @param  g  green component (0 - 255)
         * @param  b  blue component (0 - 255)
         */
        Color.getHexFromRGB = function (r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };
        /**
         * Get a CSS compatible color string from a Color enum
         *
         * @param  color  color enum
         */
        Color.getRGBFromColor = function (color) {
            return this.getRGB(this.getFromColorToHex(color), null);
        };
        /**
         * Get a CSS compatible color string from HSL color values
         *
         * @param  hue  The hue component for the color, between 0 and 360.
         * @param  saturation  The saturation component for the color, between 0 and 100.
         * @param  lightness  The lightness component for the color, between 0 and 100.
         * @param  alpha  Optional. The alpha component for the color where 0 is fully transparent and 1 is fully opaque.
         */
        Color.getHSL = function (hue, saturation, lightness, alpha) {
            if (alpha == undefined)
                return "hsl(" + (hue % 360) + "," + saturation + "%," + lightness + "%)";
            else
                return "hsla(" + (hue % 360) + "," + saturation + "%," + lightness + "%," + alpha + ")";
        };
        /**
         * Get the color representation
         *
         * @param  colorEnum  enum representing the color
         */
        Color.getColor = function (color) {
            switch (color) {
                case 0 /* Black */:
                    return "#000000";
                case 1 /* White */:
                    return "#ffffff";
                case 2 /* Red */:
                    return "#ff0000";
                case 3 /* Green */:
                    return "#00ff00";
                case 4 /* Blue */:
                    return "#0000ff";
                case 5 /* WiBlue */:
                    return "#006eb0";
                case 6 /* DarkBlue */:
                    return "#00008b";
                case 7 /* PowderBlue */:
                    return "#b0e0e6";
                case 8 /* SkyBlue */:
                    return "#87ceeb";
                case 9 /* Violet */:
                    return "#8b00ff";
                case 10 /* Yellow */:
                    return "#ffff00";
                case 11 /* Purple */:
                    return "#7f007f";
                case 12 /* Orange */:
                    return "#ff7f00";
                case 13 /* Gray */:
                    return "#808080";
                case 14 /* SlateGray */:
                    return "#708090";
                case 15 /* Aqua */:
                    return "#00ffff";
                case 16 /* Beige */:
                    return "#f5f5dc";
                case 17 /* Brown */:
                    return "#964b00";
                case 18 /* Tan */:
                    return "#d2b48c";
                case 19 /* Wheat */:
                    return "#f5deb3";
                case 20 /* CornflowerBlue */:
                    return "#6495ed";
                case 21 /* LimeGreen */:
                    return "#32cd32";
                case 22 /* Magenta */:
                    return "#ff00ff";
                case 23 /* Pink */:
                    return "#ffc9cb";
                case 24 /* Silver */:
                    return "#c0c0c0";
            }
        };
        /**
         * Get the color representation from a string
         *
         * @param  color  string color
         */
        Color.getFromString = function (color) {
            color = color.toLowerCase();
            switch (color) {
                case "black":
                    return "#000000";
                case "white":
                    return "#ffffff";
                case "red":
                    return "#ff0000";
                case "green":
                    return "#00ff00";
                case "blue":
                    return "#0000ff";
                case "wiblue":
                    return "#006eb0";
                case "darkblue":
                    return "#00008b";
                case "powderblue":
                    return "#b0e0e6";
                case "skyblue":
                    return "#87ceeb";
                case "violet":
                    return "#8b00ff";
                case "yellow":
                    return "#ffff00";
                case "purple":
                    return "#7f007f";
                case "orange":
                    return "#ff7f00";
                case "gray":
                    return "#808080";
                case "slategray":
                    return "#708090";
                case "aqua":
                    return "#00ffff";
                case "beige":
                    return "#f5f5dc";
                case "brown":
                    return "#964b00";
                case "tan":
                    return "#d2b48c";
                case "wheat":
                    return "#f5deb3";
                case "cornflowerblue":
                    return "#6495ed";
                case "limegreen":
                    return "#32cd32";
                case "magenta":
                    return "#ff00ff";
                case "pink":
                    return "#ffc9cb";
                case "silver":
                    return "#c0c0c0";
            }
        };
        /**
         * Get the color enum from a string
         *
         * @param  color  string color
         */
        Color.getFromStringToEnum = function (color) {
            color = color.toLowerCase();
            switch (color) {
                case "black":
                    return 0 /* Black */;
                case "white":
                    return 1 /* White */;
                case "red":
                    return 2 /* Red */;
                case "green":
                    return 3 /* Green */;
                case "blue":
                    return 4 /* Blue */;
                case "wiblue":
                    return 5 /* WiBlue */;
                case "darkblue":
                    return 6 /* DarkBlue */;
                case "powderblue":
                    return 7 /* PowderBlue */;
                case "skyblue":
                    return 8 /* SkyBlue */;
                case "violet":
                    return 9 /* Violet */;
                case "yellow":
                    return 10 /* Yellow */;
                case "purple":
                    return 11 /* Purple */;
                case "orange":
                    return 12 /* Orange */;
                case "gray":
                    return 13 /* Gray */;
                case "slategray":
                    return 14 /* SlateGray */;
                case "aqua":
                    return 15 /* Aqua */;
                case "beige":
                    return 16 /* Beige */;
                case "brown":
                    return 17 /* Brown */;
                case "tan":
                    return 18 /* Tan */;
                case "wheat":
                    return 19 /* Wheat */;
                case "cornflowerblue":
                    return 20 /* CornflowerBlue */;
                case "limegreen":
                    return 21 /* LimeGreen */;
                case "magenta":
                    return 22 /* Magenta */;
                case "pink":
                    return 23 /* Pink */;
                case "silver":
                    return 24 /* Silver */;
            }
        };
        /**
         * Get the color representation
         *
         * @param  colorEnum  enum representing the color
         */
        Color.getFromColorToHex = function (color) {
            switch (color) {
                case 0 /* Black */:
                    return 0x000000;
                case 1 /* White */:
                    return 0xffffff;
                case 2 /* Red */:
                    return 0xff0000;
                case 3 /* Green */:
                    return 0x00ff00;
                case 4 /* Blue */:
                    return 0x0000ff;
                case 5 /* WiBlue */:
                    return 0x006eb0;
                case 6 /* DarkBlue */:
                    return 0x00008b;
                case 7 /* PowderBlue */:
                    return 0xb0e0e6;
                case 8 /* SkyBlue */:
                    return 0x87ceeb;
                case 9 /* Violet */:
                    return 0x8b00ff;
                case 10 /* Yellow */:
                    return 0xffff00;
                case 11 /* Purple */:
                    return 0x7f007f;
                case 12 /* Orange */:
                    return 0xff7f00;
                case 13 /* Gray */:
                    return 0x808080;
                case 14 /* SlateGray */:
                    return 0x708090;
                case 15 /* Aqua */:
                    return 0x00ffff;
                case 16 /* Beige */:
                    return 0xf5f5dc;
                case 17 /* Brown */:
                    return 0x964b00;
                case 18 /* Tan */:
                    return 0xd2b48c;
                case 19 /* Wheat */:
                    return 0xf5deb3;
                case 20 /* CornflowerBlue */:
                    return 0x6495ed;
                case 21 /* LimeGreen */:
                    return 0x32cd32;
                case 22 /* Magenta */:
                    return 0xff00ff;
                case 23 /* Pink */:
                    return 0xffc9cb;
                case 24 /* Silver */:
                    return 0xc0c0c0;
            }
        };
        Color.prototype.setColor = function (color) {
            if (typeof color == "number") {
                this.value = Color.getColor(color);
            }
            else if (typeof color == "object") {
                this.value = color.value;
            }
            else {
                this.value = Color.getFromString(color);
            }
        };
        return Color;
    })();
    exports.Color = Color;
    /**
     * @file TextFactory.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Factory class used to setup text styles
     */
    var TextFactory = (function () {
        function TextFactory() {
        }
        /**
         * Create fill text
         *
         * @param  text  actor with the text on it
         * @param  color  the CSS color of the text
         */
        TextFactory.createFillText = function (text, color) {
            text.addEffect(new SolidFillEffect(color));
        };
        /**
         * Create line text
         *
         * @param  text  actor with the text on it
         * @param  color  the CSS color of the text
         * @param  lineWidth  the width in pixels of the text stroke
         */
        TextFactory.createStrokeText = function (text, color, lineWidth) {
            text.addEffect(new SolidStrokeEffect(color, lineWidth));
        };
        /**
         * Create solid outlined text
         *
         * @param  text  actor with the text on it
         * @param  color  the CSS color of the solid text
         * @param  outlineColor  the CSS color of the outline
         * @param  lineWidth  the width in pixels of the outline stroke
         */
        TextFactory.createOutlineText = function (text, color, outlineColor, lineWidth) {
            text.addEffect(new SolidStrokeEffect(outlineColor, lineWidth));
            text.addEffect(new SolidFillEffect(color));
        };
        return TextFactory;
    })();
    exports.TextFactory = TextFactory;
    /**
     * @file SpriteSheet.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Contains data that describes a sprite sheet. Used for frame based animation or atlased images.
     * Data format is based on TexturePacker JSON output.
     */
    var SpriteSheet = (function () {
        /**
         * Create a SpriteSheet object
         *
         * @param  jsonDef  contains SpriteSheet definition. If def is null then the sheet will use
         *                  the singular image.
         * @param  resources  images that JSON def references.
         * @param  transScale  translation scale. If there is no scale then value should be.
         */
        function SpriteSheet(image, scaleFactor) {
            var _this = this;
            this.asset = image;
            this.scaleFactor = scaleFactor;
            this.frames = [];
            if (image.getIsLoaded()) {
                this.generate();
            }
            else {
                image.getEvents().add({
                    onProgress: null,
                    onError: null,
                    onComplete: function () {
                        _this.generate();
                    }
                });
            }
        }
        /**
         * Get the Image resource the sheet references
         *
         * @param  id  index into resource list
         */
        SpriteSheet.prototype.getResource = function () {
            return this.asset.getPayload().image;
        };
        /**
         * Get the ImageAsset the sheet references.
         */
        SpriteSheet.prototype.getAsset = function () {
            return this.asset;
        };
        /**
         * Get a frame from the sheet
         *
         * @param  frameNum  frame number to get
         */
        SpriteSheet.prototype.getFrame = function (frameNum) {
            return (this.frames == null) ? null : this.frames[frameNum];
        };
        /**
         * Get the index of a frame. Will return -1 if frame is not found
         *
         * @param  frameName  name of frame in sprite sheet
         */
        SpriteSheet.prototype.getFrameIndex = function (frameName) {
            frameName = "resources/" + frameName;
            var index = -1;
            var frameCnt = this.frames.length;
            for (var i = 0; i < frameCnt; ++i) {
                if (frameName == this.frames[i].name) {
                    index = i;
                    break;
                }
            }
            return index;
        };
        /**
         * Get the number of frames contained in the sheet
         */
        SpriteSheet.prototype.getFrameCount = function () {
            return this.frames.length;
        };
        /**
         * Reads through a JSON definition to generate the data of a SpriteSheet
         *
         * @param  jsonDef  JSON object containing SpriteSheet definition
         * @param  transScale  translation scale
         */
        SpriteSheet.prototype.generate = function () {
            var _this = this;
            if (this.asset.getIsAnim()) {
                var frames = this.asset.getPayload().anim.frames;
                var sortedFrames = [];
                for (var name in frames) {
                    sortedFrames.push(name);
                }
                sortedFrames.sort();
                sortedFrames.forEach(function (name, i) {
                    var frame = frames[name];
                    _this.frames.push({
                        frame: i,
                        x: frame.frame.x,
                        y: frame.frame.y,
                        w: frame.sourceSize.w,
                        h: frame.sourceSize.h,
                        page: frame.page,
                        name: name,
                        rotation: 0,
                        drawW: frame.frame.w,
                        drawH: frame.frame.h
                    });
                });
            }
            else {
                var image = this.getResource();
                var width = image.width / this.scaleFactor;
                var height = image.height / this.scaleFactor;
                this.frames.push({
                    frame: 0,
                    x: 0,
                    y: 0,
                    w: width,
                    h: height,
                    page: 0,
                    name: "",
                    drawW: image.width,
                    drawH: image.height,
                    rotation: 0
                });
            }
        };
        return SpriteSheet;
    })();
    exports.SpriteSheet = SpriteSheet;
    /**
     * @file Components.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Represents the available components in
     */
    exports.Components = {
        Transform: "Transform",
        Primitive: "Primitive",
        Image: "Image",
        Video: "Video",
        VectorGraphics: "VectorGraphics",
        FrameAnimator: "FrameAnimator",
        Box: "Box",
        Text: "Text",
        Input: "Input",
        Renderable: "Renderable",
        ParticleSystem: "ParticleSystem",
        ImageSequence: "ImageSequence",
        ImageAnimator: "ImageAnimator",
        TextureMap: "TextureMap"
    };
    /**
     * @file Image.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Component to handle rendering 2d images
     */
    var Image = (function () {
        /**
         * Create a new Image object
         *
         * @param  actor  actor that owns the component
         */
        function Image(actor) {
            this.actor = actor;
            this.transform = actor.getTransform();
            this.visible = true;
            this.sheet = null;
            this.frame = 0;
            this.opacity = 1;
            this.zoom = 1;
            this.renderTransform = new Matrix2d();
            this.renderParams = [];
            this.drawBrighter = false;
            this.horzAlign = 0 /* Left */;
            this.vertAlign = 0 /* Top */;
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        /**
         * Set the visibility
         *
         * @param  visible  the visibility
         */
        Image.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility
         */
        Image.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the opacity
         *
         * @param  opacity  the opacity..[0..1]
         */
        Image.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
        };
        /**
         * Get the opacity
         */
        Image.prototype.getOpacity = function () {
            return this.opacity;
        };
        /**
         * Set the amount to scale source image within the drawing rect.
         * Until more support is needed, this will always scale relative
         * to the center of the current frame.
         * Only supports zooming in (zoom >= 1) because zooming out would
         * bleed pixels from other frames.
         *
         * @param  zoom  the zoom value
         */
        Image.prototype.setZoom = function (zoom) {
            this.zoom = zoom;
        };
        /*
         * Get the zoom
         */
        Image.prototype.getZoom = function () {
            return this.zoom;
        };
        /**
         * Set the image clipping rect
         *
         * @param  x  x coordinate
         * @param  y  y coordinate
         * @param  width  width of the clip rect
         * @param  height  height of the clip rect
         */
        Image.prototype.setClipRect = function (x, y, width, height) {
            this.clipRect = [x, y, width, height];
        };
        /**
         * Get the image clipping rect
         */
        Image.prototype.getClipRect = function () {
            return this.clipRect;
        };
        /**
         * Set the SpriteSheet to use when rendering
         *
         * @param  sheet  SpriteSheet to use
         */
        Image.prototype.setSpriteSheet = function (sheet) {
            this.sheet = sheet;
        };
        /**
         * Get the SpriteSheet being used
         */
        Image.prototype.getSpriteSheet = function () {
            return this.sheet;
        };
        /**
         * Set the frame used to access a frame in the sprite when rendering
         *
         * @param  frame  frame to use in SpriteSheet. zero based.
         */
        Image.prototype.setFrame = function (frame) {
            this.frame = frame;
        };
        /**
         * Get the current frame number that is being used
         */
        Image.prototype.getFrame = function () {
            return this.frame;
        };
        /**
         * Set the bright drawing mode
         *
         * @param  on  true to draw brighter images
         */
        Image.prototype.setDrawBrighter = function (on) {
            this.drawBrighter = on;
        };
        /**
         * Set the alignment
         *
         * @param  align  alignment
         */
        Image.prototype.setAlign = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(2 /* Center */);
                    break;
            }
        };
        /**
         * Set the X pivot location relative to the image size
         *
         * @param  horizontal  alignment on X
         */
        Image.prototype.setHorizontalAlign = function (horizontal) {
            this.horzAlign = horizontal;
            switch (horizontal) {
                case 0 /* Left */:
                    {
                        this.transform.setPivotX(0);
                    }
                    break;
                case 1 /* Right */:
                    {
                        this.transform.setPivotX(this.getDrawWidth());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotX(Math.floor(this.getDrawWidth() / 2));
                    }
                    break;
            }
        };
        /**
         * Set the Y pivot location relative to the image size
         *
         * @param  vertical  alignment on Y
         */
        Image.prototype.setVerticalAlign = function (vertical) {
            this.vertAlign = vertical;
            switch (vertical) {
                case 0 /* Top */:
                    {
                        this.transform.setPivotY(0);
                    }
                    break;
                case 1 /* Bottom */:
                    {
                        this.transform.setPivotY(this.getDrawHeight());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotY(Math.floor(this.getDrawHeight() / 2));
                    }
                    break;
            }
        };
        /**
         * Set the position relative to parent size if the parent is also an image
         *
         * @param  align  alignment
         */
        Image.prototype.alignToParent = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.alignToParentX(0 /* Left */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.alignToParentX(1 /* Right */);
                    this.alignToParentY(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.alignToParentX(1 /* Right */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.alignToParentX(0 /* Left */);
                    this.alignToParentY(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.alignToParentX(2 /* Center */);
                    this.alignToParentY(2 /* Center */);
                    break;
            }
        };
        /**
         * Set the X position relative to parent size if the parent is also an image
         *
         * @param  horizontal  alignment on X
         */
        Image.prototype.alignToParentX = function (horizontal) {
            var parent = this.transform.getParent();
            if (parent == null) {
                return;
            }
            var renderable = parent.getActor().getRenderable();
            if (renderable == undefined) {
                return;
            }
            switch (horizontal) {
                case 0 /* Left */:
                    {
                        this.transform.setPositionX(0);
                    }
                    break;
                case 1 /* Right */:
                    {
                        this.transform.setPositionX(renderable.getWidth());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPositionX(renderable.getWidth() / 2);
                    }
                    break;
            }
        };
        /**
         * Set the Y position relative to parent size if the parent is also an image
         *
         * @param  vertical  alignment on Y
         */
        Image.prototype.alignToParentY = function (vertical) {
            var parent = this.transform.getParent();
            if (parent == null) {
                return;
            }
            var renderable = parent.getActor().getRenderable();
            if (renderable == undefined) {
                return;
            }
            switch (vertical) {
                case 0 /* Top */:
                    {
                        this.transform.setPositionY(0);
                    }
                    break;
                case 1 /* Bottom */:
                    {
                        this.transform.setPositionY(renderable.getHeight());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPositionY(renderable.getHeight() / 2);
                    }
                    break;
            }
        };
        /**
         * Check the visibility of the renderable
         */
        Image.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        /**
         * Get the z rendering order of the renderable
         */
        Image.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Get the original width of the image being rendered
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        Image.prototype.getWidth = function (frame) {
            var result = 0;
            if (this.sheet != null) {
                var f = this.sheet.getFrame((frame == undefined) ? this.frame : frame);
                if (f != null) {
                    result = f.w;
                }
            }
            return result;
        };
        /**
         * Get the original height of the image being rendered
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        Image.prototype.getHeight = function (frame) {
            var result = 0;
            if (this.sheet != null) {
                var f = this.sheet.getFrame((frame == undefined) ? this.frame : frame);
                if (f != null) {
                    result = f.h;
                }
            }
            return result;
        };
        /**
         * Get the actual size of the image
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        Image.prototype.getDrawWidth = function (frame) {
            var result = 0;
            if (this.sheet != null) {
                var f = this.sheet.getFrame((frame == undefined) ? this.frame : frame);
                if (f != null) {
                    result = f.drawW;
                }
            }
            return result;
        };
        /**
         * Get the actual size of the image
         *
         * @param  frame  optinal frame number. If no frame is specified it uses current frame.
         */
        Image.prototype.getDrawHeight = function (frame) {
            var result = 0;
            if (this.sheet != null) {
                var f = this.sheet.getFrame((frame == undefined) ? this.frame : frame);
                if (f != null) {
                    result = f.drawH;
                }
            }
            return result;
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Image.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(this.frame), this.getHeight(this.frame));
            switch (this.horzAlign) {
                case 2 /* Center */:
                    bounds.move(-this.getWidth(this.frame) * 0.5, 0);
                    break;
                case 1 /* Right */:
                    bounds.move(-this.getWidth(this.frame), 0);
                    break;
            }
            switch (this.vertAlign) {
                case 2 /* Center */:
                    bounds.move(0, -this.getHeight(this.frame) * 0.5);
                    break;
                case 1 /* Bottom */:
                    bounds.move(0, -this.getHeight(this.frame));
                    break;
            }
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Image.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(this.frame), this.getDrawHeight(this.frame));
            switch (this.horzAlign) {
                case 2 /* Center */:
                    bounds.move(-this.getDrawWidth(this.frame) * 0.5, 0);
                    break;
                case 1 /* Right */:
                    bounds.move(-this.getDrawWidth(this.frame), 0);
                    break;
            }
            switch (this.vertAlign) {
                case 2 /* Center */:
                    bounds.move(0, -this.getDrawHeight(this.frame) * 0.5);
                    break;
                case 1 /* Bottom */:
                    bounds.move(0, -this.getDrawHeight(this.frame));
                    break;
            }
        };
        /**
         * Get the frame count of the sprite sheet that is being used
         */
        Image.prototype.getFrameCount = function () {
            return (this.sheet == null) ? 0 : this.sheet.getFrameCount();
        };
        /**
         * Get the transform used for rendering the image
         */
        Image.prototype.getRenderTransform = function () {
            return this.renderTransform;
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        Image.prototype.render = function (cr) {
            if (this.getActor().getName() == "transition") {
                console.log("found trans", this.getFrame(), this.frame);
            }
            if (this.sheet == null || this.opacity == 0) {
                return;
            }
            var sheetFrame = this.sheet.getFrame(this.frame);
            if (sheetFrame == null) {
                return;
            }
            this.renderTransform.setFrom(this.transform.getXfm());
            this.renderParams[0] = sheetFrame.x;
            this.renderParams[1] = sheetFrame.y;
            this.renderParams[2] = sheetFrame.drawW;
            this.renderParams[3] = sheetFrame.drawH;
            this.renderParams[4] = sheetFrame.drawW;
            this.renderParams[5] = sheetFrame.drawH;
            this.handleSheetRotation(sheetFrame);
            this.handleZoom();
            if (this.handleClip()) {
                var blendMode = (this.drawBrighter ? 'lighter' : 'source-over');
                cr.drawImage(this.renderTransform, this.sheet.getResource(), this.renderParams[0], this.renderParams[1], this.renderParams[2], this.renderParams[3], this.renderParams[4], this.renderParams[5], this.opacity, false, blendMode);
            }
        };
        /**
         * Get the actor who owns the component
         */
        Image.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        Image.prototype.getName = function () {
            return exports.Components.Image;
        };
        /**
         * Internal method to handle sprite sheet rotation
         *
         * @param  sheetFrame  sprite sheet frame to check rotation on
         */
        Image.prototype.handleSheetRotation = function (sheetFrame) {
            if (sheetFrame.rotation != 0) {
                var hw = sheetFrame.drawW * 0.5;
                var hh = sheetFrame.drawH * 0.5;
                this.renderTransform.identity().appendMatrix(this.transform.getXfm()).appendTransform(hh, hw, 1, 1, -sheetFrame.rotation, 0, 0, hw, hh);
            }
        };
        /**
         * Internal method to handle zooming
         */
        Image.prototype.handleZoom = function () {
            // Only supports zooming in because zooming out would bleed pixels from other frames
            if (this.zoom > 1) {
                //srcx += srcw * 0.5;
                //srcy += srch * 0.5;
                //srcw /= this.zoom;
                //srch /= this.zoom;
                var diffx = (this.renderParams[2] - this.renderParams[2] / this.zoom);
                var diffy = (this.renderParams[3] - this.renderParams[3] / this.zoom);
                this.renderParams[0] += diffx * 0.5;
                this.renderParams[1] += diffy * 0.5;
                this.renderParams[2] -= diffx;
                this.renderParams[3] -= diffy;
            }
        };
        /**
         * Internal method to handle clipping
         */
        Image.prototype.handleClip = function () {
            var draw = true;
            if (this.clipRect != undefined) {
                //Note: we need consider the scaling value while masking.
                if (((this.renderTransform.ty + (this.renderParams[5] * this.renderTransform.m22)) <= this.clipRect[1]) || (this.renderTransform.ty >= (this.clipRect[1] + this.clipRect[3]))) {
                    draw = false;
                }
                else if (((this.renderTransform.tx + (this.renderParams[4] * this.renderTransform.m11)) <= this.clipRect[0]) || (this.renderTransform.tx >= (this.clipRect[0] + this.clipRect[2]))) {
                    draw = false;
                }
                if (draw) {
                    if (this.renderTransform.tx < this.clipRect[0]) {
                        var dx = this.clipRect[0] - this.renderTransform.tx;
                        this.renderTransform.tx += dx;
                        this.renderParams[0] += dx;
                        this.renderParams[2] -= dx;
                        this.renderParams[4] -= dx;
                    }
                    else if ((this.renderTransform.tx + (this.renderParams[4] * this.renderTransform.m11)) > (this.clipRect[0] + this.clipRect[2])) {
                        var tempdx = (this.clipRect[0] + this.clipRect[2]) - (this.renderTransform.tx + (this.renderParams[4] * this.renderTransform.m11));
                        var perctdx = tempdx / (this.renderParams[4] * this.renderTransform.m11);
                        var dx = this.renderParams[4] * perctdx;
                        this.renderParams[2] += dx;
                        this.renderParams[4] += dx;
                    }
                    if (this.renderTransform.ty < this.clipRect[1]) {
                        var dy = this.clipRect[1] - this.renderTransform.ty;
                        this.renderTransform.ty += dy;
                        this.renderParams[1] += dy;
                        this.renderParams[3] -= dy;
                        this.renderParams[5] -= dy;
                    }
                    else if ((this.renderTransform.ty + (this.renderParams[5] * this.renderTransform.m22)) > (this.clipRect[1] + this.clipRect[3])) {
                        var tempdy = (this.clipRect[1] + this.clipRect[3]) - (this.renderTransform.ty + (this.renderParams[5] * this.renderTransform.m22));
                        var perctdy = tempdy / (this.renderParams[5] * this.renderTransform.m22);
                        var dy = this.renderParams[5] * perctdy;
                        this.renderParams[5] += dy;
                        this.renderParams[3] += dy;
                    }
                }
            }
            return draw;
        };
        return Image;
    })();
    exports.Image = Image;
    /**
     * @file Runtime.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Class used as the core of a game. Handles running the frame update loop and timing
     * functionality. Any number of objects can register for frame ticks as long as they
     * implement the ITickable interface.
     */
    var Runtime = (function () {
        /**
         * Creates a Runtime object
         *
         * @param  time  time object
         * @param  html5Window  window object to use
         */
        function Runtime(time, html5window) {
            var _this = this;
            this.time = time;
            this.startTime = time.now();
            this.interval = 16;
            this.lastTime = this.startTime;
            this.smoothFrameDelta = 0;
            this.started = false;
            this.measureFPS = false;
            this.registeredFTO = Array();
            this.rafCall = new RequestAnimationFrame(window, function (time) { return _this.handleAnimFrame(time); });
            this.setInterval(this.interval);
            this.start();
        }
        /**
         * Set the interval, in milliseconds, at which the runtime will tick.
         *
         * @param  interval  duration in milliseconds that runtime will tick at.
         */
        Runtime.prototype.setInterval = function (interval) {
            this.interval = interval;
        };
        /**
         * Get the interval, in milliseconds, at which the runtime will tick.
         */
        Runtime.prototype.getInterval = function () {
            return this.interval;
        };
        /**
         * Set the rate, in frames per second, at which the runtime will tick.
         *
         * @param  value  frames per second at which the runtime will tick at.
         */
        Runtime.prototype.setFramerate = function (value) {
            setInterval(1000 / value);
        };
        /**
         * Get the rate, in frames per second, at which the runtime will tick.
         */
        Runtime.prototype.getFramerate = function () {
            return 1000 / this.interval;
        };
        /**
         * Register an object to be ticked on each frame update of the runtime
         *
         * @param  tickable  object that implements the ITickable interface
         */
        Runtime.prototype.registerForFrameTick = function (tickable) {
            this.registeredFTO.push(tickable);
        };
        /**
         * Causes the runtime to start ticking
         */
        Runtime.prototype.start = function () {
            if (!this.started) {
                this.started = true;
                this.handleAnimFrame(0);
            }
        };
        /**
         * Causes the runtime to stop ticking
         */
        Runtime.prototype.stop = function () {
            this.started = false;
        };
        /**
         * Internal method to handle the frame tick from the browser
         *
         * @param  time  delta frame time
         */
        Runtime.prototype.handleAnimFrame = function (time) {
            if (!this.started)
                return;
            var time = this.time.now();
            var elapsedTime = (time - this.lastTime);
            this.rafCall.request(this.interval);
            this.lastTime = time;
            this.tick(time, elapsedTime);
        };
        /**
         * Internal method to tick the runtime to the next frame
         *
         * @param  time  current clock time
         * @param  elapsedTime  time elapsed since last frame
         */
        Runtime.prototype.tick = function (time, elapsedTime) {
            var frameDelta = elapsedTime * 0.001;
            // Apply Generalized DEMA algorithm to smooth frame delta in an attempt to filter out
            // minor spikes. Using Low-Pass-Filter at ~8fps to avoid huge spikes
            this.smoothFrameDelta = this.calculateSmoothFrameDelta(Math.min(frameDelta, 0.1333333));
            var ticker;
            var tickCalls = this.registeredFTO.length;
            for (var i = 0; i < tickCalls; ++i) {
                ticker = this.registeredFTO[i];
                ticker.tick(time, this.smoothFrameDelta);
            }
        };
        /**
         * Calculate the exponential moving average (that we use to smooth the frame delta)
         *
         * @param  deltaSec  frame delta to average with the existing (running) value
         */
        Runtime.prototype.ema = function (deltaSec) {
            var n = 5; // how many frames to apply the EMA over
            return 2 / (1 + n) * (deltaSec - this.smoothFrameDelta) + this.smoothFrameDelta;
        };
        /**
         * Calculate the generalized DEMA (double EMA) that is used to smooth the frame delta
         *
         * @param  deltaSec  frame delta to average with the existing (running) value
         * @param  weight    number between 0 and 1 which determines the moving average's
         *                   response to linear trends. If 0, result is pure EMA. if 1, result
         *                   is pure DEMA. Defaults to 0.7 per source whitepaper
         */
        Runtime.prototype.gd = function (deltaSec, weight) {
            return this.ema(deltaSec) * (1 + weight) - this.ema(this.ema(deltaSec)) * weight;
        };
        /**
         * Calculate the smooth frame delta
         *
         * @param  frameDelta  current frame delta
         */
        Runtime.prototype.calculateSmoothFrameDelta = function (frameDelta) {
            return this.gd(this.gd(this.gd(frameDelta, 0.7), 0.7), 0.7);
        };
        return Runtime;
    })();
    exports.Runtime = Runtime;
    /**
     * @file Axis.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Defines the axes available on a cartesian plane
     */
    (function (Axis) {
        Axis[Axis["X"] = 0] = "X";
        Axis[Axis["Y"] = 1] = "Y";
    })(exports.Axis || (exports.Axis = {}));
    var Axis = exports.Axis;
    /**
     * @file Transform.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Component to handle 2d transformations in a scene
     */
    var Transform = (function () {
        /**
         * Create a new Transform object
         *
         * @param  actor  actor that owns the component
         * @param  parent  parent transform
         * @param  scene  scene that owns the transform
         */
        function Transform(actor, parent, scene) {
            this.visible = true;
            this.actor = actor;
            this.mtx = new Matrix2d();
            this.worldMtx = new Matrix2d();
            this.dirtyXfm = true;
            this.dirtyWorldXfm = true;
            this.useTranslationScale = true;
            this.zOrder = 0;
            this.worldZOrder = 0;
            this.rot = 0;
            this.position = [0, 0];
            this.scale = [1, 1];
            this.skew = [0, 0];
            this.pivot = [0, 0];
            this.translationScale = 1;
            this.parent = parent;
            this.child = null;
            this.sibling = null;
            this.attachment = null;
            this.scene = scene;
            if (actor != undefined && actor != null) {
                actor.addComponent(this.getName(), this);
            }
        }
        /**
         * Set the visibility
         *
         * @param  visible  the visibility
         */
        Transform.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility
         */
        Transform.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the local position
         *
         * @param positionX  local x position
         * @param positionY  local y position
         */
        Transform.prototype.setPosition = function (positionX, positionY) {
            this.position[0] = positionX;
            this.position[1] = positionY;
            this.dirtyXfm = true;
        };
        /**
         * Get the local X position
         */
        Transform.prototype.getPositionX = function () {
            return this.position[0];
        };
        /**
         * Get the local translated X position
         */
        Transform.prototype.getTranslatedPositionX = function () {
            return this.translatePosition(0 /* X */, this.position[0], this.position[1]);
        };
        /**
         * Set the local X position
         */
        Transform.prototype.setPositionX = function (val) {
            this.position[0] = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the local Y position
         */
        Transform.prototype.getPositionY = function () {
            return this.position[1];
        };
        /**
         * Get the local translated Y position
         */
        Transform.prototype.getTranslatedPositionY = function () {
            return this.translatePosition(1 /* Y */, this.position[0], this.position[1]);
        };
        /**
         * Set the local Y position
         */
        Transform.prototype.setPositionY = function (val) {
            this.position[1] = val;
            this.dirtyXfm = true;
        };
        /**
         * Set the local pivot position
         *
         * @param  pivotX  local x position
         * @param  pivotY  local y position
         */
        Transform.prototype.setPivot = function (pivotX, pivotY) {
            this.pivot[0] = pivotX;
            this.pivot[1] = pivotY;
            this.dirtyXfm = true;
        };
        /**
         * Get the local pivot X position
         */
        Transform.prototype.getPivotX = function () {
            return this.pivot[0];
        };
        /**
         * Set the local pivot X position
         */
        Transform.prototype.setPivotX = function (val) {
            this.pivot[0] = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the local pivot Y position
         */
        Transform.prototype.getPivotY = function () {
            return this.pivot[1];
        };
        /**
         * Set the local pivot Y position
         */
        Transform.prototype.setPivotY = function (val) {
            this.pivot[1] = val;
            this.dirtyXfm = true;
        };
        /**
         * Set the local scale
         *
         * @param  scaleX  local x scale
         * @param  scaleY  local y scale
         */
        Transform.prototype.setScale = function (scaleX, scaleY) {
            this.scale[0] = scaleX;
            this.scale[1] = scaleY;
            this.dirtyXfm = true;
        };
        /**
         * Get the local scale X
         */
        Transform.prototype.getScaleX = function () {
            return this.scale[0];
        };
        /**
         * Set the local scale X
         */
        Transform.prototype.setScaleX = function (val) {
            this.scale[0] = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the local scale Y
         */
        Transform.prototype.getScaleY = function () {
            return this.scale[1];
        };
        /**
         * Set the local scale Y
         */
        Transform.prototype.setScaleY = function (val) {
            this.scale[1] = val;
            this.dirtyXfm = true;
        };
        /**
         * Set the local skew
         *
         * @param  skewX  local x skew
         * @param  skewY  local y skew
         */
        Transform.prototype.setSkew = function (skewX, skewY) {
            this.skew[0] = skewX;
            this.skew[1] = skewY;
            this.dirtyXfm = true;
        };
        /**
         * Get the local skew X
         */
        Transform.prototype.getSkewX = function () {
            return this.skew[0];
        };
        /**
         * Set the local skew X
         */
        Transform.prototype.setSkewX = function (val) {
            this.skew[0] = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the local skew Y
         */
        Transform.prototype.getSkewY = function () {
            return this.skew[1];
        };
        /**
         * Set the local skew Y
         */
        Transform.prototype.setSkewY = function (val) {
            this.skew[1] = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the rotation
         */
        Transform.prototype.getRotation = function () {
            return this.rot;
        };
        /**
         * Set the rotation
         */
        Transform.prototype.setRotation = function (val) {
            this.rot = val;
            this.dirtyXfm = true;
        };
        /**
         * Get the local z
         */
        Transform.prototype.getZOrder = function () {
            return this.zOrder;
        };
        /**
         * Set the local z
         */
        Transform.prototype.setZOrder = function (z) {
            this.zOrder = z;
            this.scene.sortScene();
        };
        /**
         * Get the world z
         */
        Transform.prototype.getWorldZOrder = function () {
            return this.worldZOrder;
        };
        /**
         * Set the world z
         */
        Transform.prototype.setWorldZOrder = function (z) {
            this.worldZOrder = z;
        };
        /**
         * Set whether or not translation scale is used
         *
         * @param  useTranslationScale  true if translation scale should be used
         */
        Transform.prototype.setUseTranslationScale = function (useTranslationScale) {
            this.useTranslationScale = useTranslationScale;
        };
        /**
         * Get whether or not translation scale is used
         */
        Transform.prototype.getUseTranslationScale = function () {
            return this.useTranslationScale;
        };
        /**
         * Set the world translation scale. Ued to scale the translation of the transform position.
         *
         * @param  scale  translation scale. If there is no scale then value should be 1.
         */
        Transform.prototype.setTranslationScale = function (scale) {
            this.translationScale = scale;
            this.dirtyXfm = true;
        };
        /**
         * Get the translation  scale
         */
        Transform.prototype.getTranslationScale = function () {
            return this.translationScale;
        };
        /**
         * Set the parent of the transform
         *
         * @param  parent  parent to to use
         * @param  scene  scene that transform is in
         */
        Transform.prototype.setParent = function (parent, scene) {
            if (this.parent == parent) {
                return;
            }
            // If the new parent passed in is a child of ours we first need to remove that child
            // to allow it to be our parent and not our parent and child simultaneously.
            if (parent != null) {
                if (parent.parent == this) {
                    parent.setParent(null, scene);
                }
            }
            // Remove and add to scene which manages the NodeTree Note that parent can be NULL,
            // and handles this just fine It will actually parent the sprite to the tree root node
            scene.removeTransform(this);
            scene.addTransform(this, parent);
            // Set this object's world matrix and all child world matrices dirty
            this.doWorldTransformDirtyPass();
            scene.sortScene();
        };
        /**
         * Set the attachment for the transform to track with. This transform will use the
         * attachment as a transform in wold space to align itself with
         */
        Transform.prototype.setAttachment = function (attachment) {
            this.attachment = attachment;
        };
        /**
         * Called to invalidate the transform. The transform will recalculate its internal matrix.
         */
        Transform.prototype.invalidate = function () {
            this.dirtyXfm = true;
            this.dirtyWorldXfm = true;
            this.doTransformPass();
        };
        /**
         * Check if the transform is visible is the scene
         */
        Transform.prototype.isVisible = function () {
            return (this.parent == null) ? this.visible : (this.visible && this.parent.isVisible());
        };
        /**
         * Add a child node
         *
         * @param  child  child node to add
         */
        Transform.prototype.addChild = function (child) {
            child.parent = this;
            if (this.child == null) {
                this.child = child;
                this.child.sibling = this.child;
            }
            else {
                this.child.addSibling(child);
            }
        };
        /**
         * Remove a child node
         *
         * @param  child  child to remove
         */
        Transform.prototype.removeChild = function (child) {
            if (this.child != null) {
                if (((this.child.sibling == null) || (this.child.sibling == this.child)) && (this.child == child)) {
                    this.child.parent = null;
                    this.child.sibling = null;
                    this.child = null;
                }
                else {
                    this.child.sibling.removeSibling(child);
                }
            }
        };
        /**
         * Add a sibling node
         *
         * @param  sibling  sibling node to add
         */
        Transform.prototype.addSibling = function (sibling) {
            sibling.parent = this.parent;
            // Create circular list by connecting the sibling
            // to the initial parented sibling and then breaking
            // the connection from teh last in list and re-connecting here
            if ((this.sibling == null) || (this.sibling == this.parent.child)) {
                this.sibling = sibling;
                sibling.sibling = this.parent.child;
            }
            else {
                this.sibling.addSibling(sibling);
            }
        };
        /**
         * Remove a sibling
         *
         * @param  sibling  sibling to remove
         */
        Transform.prototype.removeSibling = function (sibling) {
            if ((sibling == this) && ((this.sibling == this) || (this.sibling == null))) {
                // We are circular and hitting ourself, which means that this node
                // is its own sibling
                return;
            }
            if (this.sibling != null) {
                if (this.sibling == sibling) {
                    // Re-connect the circular list to one past this. This
                    // effectively removes the next sibling from the list
                    if (sibling == this.parent.child)
                        this.parent.child = sibling.sibling;
                    this.sibling = sibling.sibling;
                    sibling.sibling = null;
                    sibling.parent = null;
                }
                else {
                    this.sibling.removeSibling(sibling);
                }
            }
        };
        /**
         * Do a pass on the node tree recursively to set transforms
         */
        Transform.prototype.doTransformPass = function () {
            if (this.dirtyXfm) {
                var x = this.position[0];
                var y = this.position[1];
                if (this.translationScale != 1 && this.useTranslationScale) {
                    // We need to scale the positions based on the distance from the origin
                    var theta = Math.atan2(this.position[1], this.position[0]);
                    var h = this.position[1] / Math.sin(theta);
                    var h1 = h * this.translationScale;
                    var x1 = h1 * Math.cos(theta);
                    var y1 = h1 * Math.sin(theta);
                    if (x == 0) {
                        y = Math.round(y * this.translationScale);
                    }
                    else if (y == 0) {
                        x = Math.round(x * this.translationScale);
                    }
                    else {
                        x = x1;
                        y = y1;
                    }
                    x = Math.floor(x);
                    y = Math.floor(y);
                }
                this.mtx.identity().appendTransform(x, y, this.scale[0], this.scale[1], this.rot, this.skew[0], this.skew[1], this.pivot[0], this.pivot[1]);
                this.dirtyXfm = false;
                this.doWorldTransformDirtyPass();
            }
            if (this.dirtyWorldXfm || this.attachment != null) {
                if (this.attachment != null) {
                    this.worldMtx.identity().appendMatrix(this.attachment.worldMtx).appendMatrix(this.mtx);
                }
                else if (this.parent != null) {
                    this.worldMtx.identity().appendMatrix(this.parent.worldMtx).appendMatrix(this.mtx);
                }
                else {
                    this.worldMtx.identity().appendMatrix(this.mtx);
                }
                this.dirtyWorldXfm = false;
            }
            if (this.child != null) {
                this.child.doTransformPass();
                this.child.doTransformPassOnSiblings();
            }
        };
        /**
         * Recursively set self and children transforms dirty
         */
        Transform.prototype.doWorldTransformDirtyPass = function () {
            this.dirtyWorldXfm = true;
            if (this.child != null) {
                this.child.doWorldTransformDirtyPass();
                this.child.doWorldTransformDirtyPassOnSiblings();
            }
        };
        /**
         * Do a transform pass on the node's siblings
         */
        Transform.prototype.doTransformPassOnSiblings = function () {
            if ((this.sibling != null) && (this.sibling != this.parent.child)) {
                this.sibling.doTransformPass();
                this.sibling.doTransformPassOnSiblings();
            }
        };
        /**
         * Do a dirty pass on siblings
         */
        Transform.prototype.doWorldTransformDirtyPassOnSiblings = function () {
            if ((this.sibling != null) && (this.sibling != this.parent.child)) {
                this.sibling.doWorldTransformDirtyPass();
                this.sibling.doWorldTransformDirtyPassOnSiblings();
            }
        };
        /**
         * Removes the node from its parent
         */
        Transform.prototype.orphan = function () {
            this.parent = null;
        };
        /**
         * Get the number of nodes under this one
         *
         * @param  startNode  node to start at, if null starts at this node (optional)
         */
        Transform.prototype.getNumNodes = function (startNode) {
            if (startNode == undefined)
                startNode = this;
            var retval = 1;
            if (this.child != null)
                retval += this.child.getNumNodes(this.child);
            if ((this.sibling != null) && (this.sibling != startNode))
                retval += this.sibling.getNumNodes(startNode);
            return retval;
        };
        /**
         * Get the number of levels in the node tree
         *
         * @param  startNode  node to start at, if null starts at this node (optional)
         */
        Transform.prototype.getNumLevels = function (startNode) {
            if (startNode == undefined)
                startNode = this;
            var retval = 1;
            var retval2 = 0;
            if (this.child != null)
                retval += this.child.getNumLevels(this.child);
            if ((this.sibling != null) && (this.sibling != startNode))
                retval2 += this.sibling.getNumLevels(startNode);
            var max = retval > retval2;
            return (max ? retval : retval2);
        };
        /**
         * Call to get the scene transform
         */
        Transform.prototype.getXfm = function () {
            return this.worldMtx;
        };
        /**
         * Get the transform parent
         */
        Transform.prototype.getParent = function () {
            return this.parent;
        };
        /**
         * Get the transform child
         */
        Transform.prototype.getChild = function () {
            return this.child;
        };
        /**
         * Get the transform sibling
         */
        Transform.prototype.getSibling = function () {
            return this.sibling;
        };
        /**
         * Get the actor who owns the component
         */
        Transform.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        Transform.prototype.getName = function () {
            return exports.Components.Transform;
        };
        /**
         * Translate the x and y positions using the translation scale
         *
         * @param  which  axis to return
         * @param  x  x position to translate
         * @param  y  y position to translate
         */
        Transform.prototype.translatePosition = function (which, x, y) {
            var theta = Math.atan2(this.position[1], this.position[0]);
            var h = this.position[1] / Math.sin(theta);
            var h1 = h * this.translationScale;
            var x1 = h1 * Math.cos(theta);
            var y1 = h1 * Math.sin(theta);
            if (x == 0) {
                y = Math.round(y * this.translationScale);
            }
            else if (y == 0) {
                x = Math.round(x * this.translationScale);
            }
            else {
                x = x1;
                y = y1;
            }
            x = Math.floor(x);
            y = Math.floor(y);
            if (which == 0 /* X */)
                return x;
            return y;
        };
        return Transform;
    })();
    exports.Transform = Transform;
    /**
     * @file Time.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Class used to get the current time
     */
    var Time = (function () {
        /**
         * Stores the performance time function to be used at runtime.
         */
        function Time() {
            this.timeFunc = window.performance || { now: function () {
                return 0;
            } };
            this.timeFunc.now = function () {
                return Date.now();
            };
        }
        /**
         * Called to get the current time in milliseconds
         */
        Time.prototype.now = function () {
            return this.timeFunc.now();
        };
        return Time;
    })();
    exports.Time = Time;
    ;
    /**
     * Used to request an animation frame from the browser
     */
    var RequestAnimationFrame = (function () {
        /**
         * Construct a RequestAnimationFrame object
         *
         * @param  window  window in which the RAF is in
         * @param  callback  callback to call on request
         */
        function RequestAnimationFrame(win, callback) {
            if (win.requestAnimationFrame || win.msRequestAnimationFrame || win.webkitRequestAnimationFrame || win.mozRequestAnimationFrame || win.oRequestAnimationFrame) {
                this.rafFunction = function (frc) { return (win.requestAnimationFrame || win.msRequestAnimationFrame || win.webkitRequestAnimationFrame || win.mozRequestAnimationFrame || win.oRequestAnimationFrame)(frc); };
            }
            this.callback = callback;
        }
        /**
         * Check to see if RAF exists
         */
        RequestAnimationFrame.prototype.hasRAF = function () {
            return (this.rafFunction != undefined);
        };
        /**
         * Called to request a callback on the next frame update.
         *
         * @param  interval  callback interval in case RAF does not exist
         */
        RequestAnimationFrame.prototype.request = function (interval) {
            if (this.rafFunction != undefined) {
                this.rafFunction(this.callback);
            }
            else {
                setTimeout(this.callback, interval);
            }
        };
        return RequestAnimationFrame;
    })();
    exports.RequestAnimationFrame = RequestAnimationFrame;
    /**
     * @file Factory.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    var Factory = (function () {
        function Factory() {
        }
        /**
         * Compose a transform actor
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         */
        Factory.composeTransform = function (scene, parent) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            scene.addTransform(xfm, parentXfm);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose a box
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         */
        Factory.composeBox = function (scene, parent) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var box = new Box(actor);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(box);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose an image
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         */
        Factory.composeImage = function (scene, parent, spriteSheet) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var img = new Image(actor);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(img);
            scene.addActor(actor);
            if (spriteSheet != null) {
                actor.getImage().setSpriteSheet(spriteSheet);
            }
            return actor;
        };
        /**
         * Compose vector graphics
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         * @param  width  width of the backing render canvas
         * @param  height  height of the backing render canvas
         */
        Factory.composeVectorGraphics = function (scene, parent, width, height) {
            var actor = new Actor;
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var xfm = new Transform(actor, parentXfm, scene);
            var vg = new VectorGraphics(actor, xfm, canvas);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(vg);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose a framed animiation
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         */
        Factory.composeFramedAnimation = function (scene, parent) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var img = new Image(actor);
            var fa = new FrameAnimator(actor);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(img);
            scene.addActor(actor);
            return actor;
        };
        Factory.composeImageAnimation = function (scene, parent) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var imageSequence = new ImageSequence(actor);
            var imageAnimator = new ImageAnimator(actor);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(imageSequence);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose text
         *
         * @param  scene  scene actor is in
         * @param  actor  actor to compose
         * @param  parent  actor parent
         * @param  canvas  canvas for text rendering
         */
        Factory.composeText = function (scene, parent) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var text = new Text(actor);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(text);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose a ParticleSystem
         *
         * @param  scene  scene actor is in
         * @param  parent  actor parent
         * @param  maxParticleCount  max number of particles
         */
        Factory.composeParticleSystem = function (scene, parent, maxParticleCount) {
            var actor = new Actor();
            var parentXfm = null;
            if (parent != null) {
                parentXfm = parent.getTransform();
            }
            var xfm = new Transform(actor, parentXfm, scene);
            var img = new ParticleSystem(actor, xfm, maxParticleCount);
            scene.addTransform(xfm, parentXfm);
            scene.addRenderable(img);
            scene.addActor(actor);
            return actor;
        };
        /**
         * Compose an input region based on an Actor. If the actor has a valid renderable an
         * input region will be added, if not no action will be taken
         *
         * @param  actor  actor to setup with input
         * @param  inputResolver  the input resolver to use for input
         * @param  bounds  bounds for rect calculation
         * @param  onStart  the on input start callback (optional)
         * @param  onMove  the on input move callback (optional)
         * @param  onEnd the on input end callback (optional)
         */
        Factory.composeInputRegion = function (actor, inputResolver, bounds, onStartFunc, onMoveFunc, onEndFunc) {
            var renderable = actor.getRenderable();
            if (renderable == undefined)
                return;
            var xfm = actor.getTransform();
            renderable.getDrawBounds(bounds);
            var inputRegion = {
                touchPosX: 0,
                touchPosY: 0,
                onStart: (onStartFunc == undefined || onStartFunc == null) ? function () {
                } : onStartFunc,
                onMove: (onMoveFunc == undefined || onMoveFunc == null) ? function () {
                } : onMoveFunc,
                onEnd: (onEndFunc == undefined || onEndFunc == null) ? function () {
                } : onEndFunc,
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
                    return xfm.getWorldZOrder();
                },
                isActive: function () {
                    return true;
                },
                isBlocking: function () {
                    return false;
                }
            };
            inputResolver.addRegion(inputRegion);
        };
        /**
         * Compose an HTMLCanvasElement based on a sprite sheet frame
         *
         * @param  frame  the frame to use in the sheet
         * @param  spriteSheet  sprite sheet to create from
         */
        Factory.composeCanvasElementFromFromImage = function (frame, spriteSheet) {
            var sheetFrame = spriteSheet.getFrame(frame);
            var canvas = document.createElement('canvas');
            canvas.width = sheetFrame.drawW;
            canvas.height = sheetFrame.drawH;
            var canvasContext = canvas.getContext('2d');
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);
            canvasContext.setTransform(1, 0, 0, 1, 0, 0);
            var image = spriteSheet.getResource();
            canvasContext.drawImage(image, sheetFrame.x, sheetFrame.y, sheetFrame.drawW, sheetFrame.drawH, 0, 0, sheetFrame.drawW, sheetFrame.drawH);
            return canvas;
        };
        /**
         * Call to create a Scene
         *
         * @param  parentDiv  the parent div element on the page
         * @param  width  scene width
         * @param  height  scene height
         * @param  responsive  true if canvas should be responsive in the window
         * @param  sceneScalar  scaling factor for scene
         * @param  autoRefresh  true to have scene refresh itself
         * @param  poolSize  Optional. The size of each memory pool.
         */
        Factory.createScene = function (parentDiv, width, height, sceneScalar, responsive, autoRefresh, rectPoolSize, imagePoolSize) {
            var defaultSize = 100;
            if (rectPoolSize == undefined) {
                rectPoolSize = defaultSize;
            }
            if (imagePoolSize == undefined) {
                imagePoolSize = defaultSize;
            }
            var canvas = new Canvas(parentDiv, width, height);
            if (responsive) {
                canvas.enableResponsiveScaling();
            }
            var canvasRenderer = new CanvasRenderer(canvas);
            canvasRenderer.initialize(rectPoolSize, imagePoolSize);
            return new Scene(canvasRenderer, sceneScalar, autoRefresh);
        };
        return Factory;
    })();
    exports.Factory = Factory;
    /**
     * @file Actor.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Represents a graphical entity
     */
    var Actor = (function () {
        /**
         * Create an Actor object
         *
         * @param  name  optional string name of actor
         */
        function Actor(name) {
            this.handle = Actor.uidCounter++;
            this.name = name;
            this.componentsColl = {};
        }
        /**
         * Add a new component to the actor
         *
         * @param  name  name of compoonent
         * @param  comp  component to add to the actor
         */
        Actor.prototype.addComponent = function (name, comp) {
            this.componentsColl[name] = comp;
        };
        /**
         * Getter to access the components collection. This should only be used to obtain
         * a component for use. User should not add or remove or re-initialize the component
         * collection. Collection access is allowed for fast access of components during runtime.
         */
        Actor.prototype.getComponents = function () {
            return this.componentsColl;
        };
        /**
         * Get the actor handle
         */
        Actor.prototype.getHandle = function () {
            return this.handle;
        };
        /**
         * Get the name
         */
        Actor.prototype.getName = function () {
            return this.name;
        };
        /**
         * Set the name
         */
        Actor.prototype.setName = function (name) {
            this.name = name;
        };
        /**
         * Get the Transform Component
         */
        Actor.prototype.getTransform = function () {
            return this.componentsColl.Transform;
        };
        /**
         * Get the Image Component
         */
        Actor.prototype.getImage = function () {
            return this.componentsColl.Image;
        };
        /**
         * Get the FrameAnimator Component
         */
        Actor.prototype.getFrameAnimator = function () {
            return this.componentsColl.FrameAnimator;
        };
        Actor.prototype.getImageSequence = function () {
            return this.componentsColl.ImageSequence;
        };
        Actor.prototype.getImageAnimator = function () {
            return this.componentsColl.ImageAnimator;
        };
        /**
         * Get the VectorGraphics Component
         */
        Actor.prototype.getVectorGraphics = function () {
            return this.componentsColl.VectorGraphics;
        };
        /**
         * Get the Box Component
         */
        Actor.prototype.getBox = function () {
            return this.componentsColl.Box;
        };
        /**
         * Get the Text Component
         */
        Actor.prototype.getText = function () {
            return this.componentsColl.Text;
        };
        /**
         * Get a renderable Component. If there is no renderable then the object will return
         * as undefined.
         */
        Actor.prototype.getRenderable = function () {
            return this.componentsColl.Renderable;
        };
        /**
         * Get the ParticleSystem Component
         */
        Actor.prototype.getParticleSystem = function () {
            return this.componentsColl.ParticleSystem;
        };
        Actor.prototype.getTexureMap = function () {
            return this.componentsColl.TextureMap;
        };
        /** Internal unique identifier counter */
        Actor.uidCounter = 1;
        return Actor;
    })();
    exports.Actor = Actor;
    /**
     * @file Profiler.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Used to do system profiling
     */
    var Profiler = (function () {
        /**
         * Create a Profiler object
         *
         * @param  win  the window object
         */
        function Profiler(win) {
            this.timeProfiles = {};
            this.accumTimeProfiles = {};
            this.infoProfiles = {};
            this.systemInfo = new Array();
            this.maxSysInfoCount = 15;
            this.consoleLog = false;
            this.timeFunc = win.performance || { now: undefined };
            if ((this.timeFunc.now == null) && win.performance) {
                this.timeFunc.now = win.performance.now || win.performance.mozNow || win.performance.msNow || win.performance.oNow || win.performance.webkitNow || function () {
                    return Date.now();
                };
            }
            else {
                this.timeFunc.now = function () {
                    return Date.now();
                };
            }
        }
        /**
         * Enable/disable logging to the console when inserting entries for log
         *
         * @param  enable  true to enable console logging
         */
        Profiler.prototype.enableConsoleLogging = function (enable) {
            this.consoleLog = enable;
        };
        /**
         * Set the amount of logging info lines that are cached
         *
         * @param  lineCount  the number of lines to keep of log info
         */
        Profiler.prototype.setLogInfoLinesCount = function (lineCount) {
            this.maxSysInfoCount = lineCount;
        };
        /**
         * Set a profile value
         *
         * @param  profile  the name of the profile
         * @param  value  the profile value
         */
        Profiler.prototype.setValue = function (profile, value) {
            this.infoProfiles[profile] = value;
        };
        /**
         * Set a time profile value
         *
         * @param  profile  the name of the profile
         * @param  value  the profile value
         */
        Profiler.prototype.setTimeValue = function (profile, value) {
            this.timeProfiles[profile] = value;
        };
        /**
         * Sets up an accumulated profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.strikeAccumulatedProfile = function (profile) {
            this.accumTimeProfiles[profile] = { current: 0, duration: 0 };
        };
        /**
         * Start a time profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.start = function (profile) {
            this.timeProfiles[profile] = this.timeFunc.now();
        };
        /**
         * Stop a time profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.stop = function (profile) {
            this.timeProfiles[profile] = (this.timeFunc.now() - this.timeProfiles[profile]);
        };
        /**
         * Start an accumulated time profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.startAccumulated = function (profile) {
            this.accumTimeProfiles[profile].current = this.timeFunc.now();
        };
        /**
         * Stop an accumulated time profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.stopAccumulated = function (profile) {
            this.accumTimeProfiles[profile].duration += (this.timeFunc.now() - this.accumTimeProfiles[profile].current);
        };
        /**
         * Log system information
         *
         * @param  info  the info string to log
         */
        Profiler.prototype.log = function (info) {
            if (this.consoleLog) {
                console.log(info);
            }
            if (this.systemInfo.length == this.maxSysInfoCount) {
                this.systemInfo.pop();
            }
            this.systemInfo.unshift(info);
        };
        /**
         * Reset the specified info profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.resetInfo = function (profile) {
            this.infoProfiles[profile] = "";
        };
        /**
         * Reset the specified profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.resetTime = function (profile) {
            this.timeProfiles[profile] = 0;
        };
        /**
         * Reset the specified accumulated time profile
         *
         * @param  profile  the name of the profile
         */
        Profiler.prototype.resetAccumulatedTime = function (profile) {
            this.accumTimeProfiles[profile].current = 0;
            this.accumTimeProfiles[profile].duration = 0;
        };
        /**
         * Get the collection of time profiles
         */
        Profiler.prototype.getTimeProfiles = function () {
            return this.timeProfiles;
        };
        /**
         * Get the collection of accumulatd time profiles
         */
        Profiler.prototype.getAccumulatedTimeProfiles = function () {
            return this.accumTimeProfiles;
        };
        /**
         * Get the collection of info profiles
         */
        Profiler.prototype.getInfoProfiles = function () {
            return this.infoProfiles;
        };
        /**
         * Get the system info collection
         */
        Profiler.prototype.getSystemInfo = function () {
            return this.systemInfo;
        };
        return Profiler;
    })();
    exports.Profiler = Profiler;
    /**
     * @file ImageDescriptor.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Descriptor used to render images
     */
    var TextureMapDescriptor = (function () {
        /**
         * Create a new RectangleDescriptor
         */
        function TextureMapDescriptor() {
            this.resetDefaults();
            this.mtx = new Matrix2d();
        }
        /**
         * Set a profiler object to use
         *
         * @param  profiler  profiler object
         */
        TextureMapDescriptor.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
        };
        /**
         * Reset all values
         */
        TextureMapDescriptor.prototype.resetDefaults = function () {
            this.opacity = 1;
            this.pixelSnap = false;
            this.blendMode = 'source-over';
        };
        /**
         * Called to render
         *
         * @param  canvasRenderer  canvas to use for rendering
         */
        TextureMapDescriptor.prototype.render = function (canvasRenderer) {
            if (this.profiler != undefined) {
                this.profiler.startAccumulated('ImageDescriptor.render');
            }
            canvasRenderer.updateOpacity(this.opacity);
            canvasRenderer.updateBlendMode(this.blendMode);
            canvasRenderer.getCanvas().drawTextureMap(this.image, this.pts);
            if (this.profiler != undefined) {
                this.profiler.stopAccumulated('ImageDescriptor.render');
            }
        };
        /**
         * Called to get the rendering transform
         */
        TextureMapDescriptor.prototype.getTransform = function () {
            return this.mtx;
        };
        /**
         * Checks to see if pixel snapping should be applied when rendering
         */
        TextureMapDescriptor.prototype.snapToPixel = function () {
            return this.pixelSnap;
        };
        return TextureMapDescriptor;
    })();
    exports.TextureMapDescriptor = TextureMapDescriptor;
    /**
     * @file ImageDescriptor.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Descriptor used to render images
     */
    var ImageDescriptor = (function () {
        /**
         * Create a new RectangleDescriptor
         */
        function ImageDescriptor() {
            this.resetDefaults();
            this.mtx = new Matrix2d();
        }
        /**
         * Set a profiler object to use
         *
         * @param  profiler  profiler object
         */
        ImageDescriptor.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
        };
        /**
         * Reset all values
         */
        ImageDescriptor.prototype.resetDefaults = function () {
            this.opacity = 1;
            this.pixelSnap = false;
            this.sourceX = 0;
            this.sourceY = 0;
            this.sourceWidth = 0;
            this.sourceHeight = 0;
            this.destWidth = 0;
            this.destHeight = 0;
            this.blendMode = 'source-over';
        };
        /**
         * Called to render
         *
         * @param  canvasRenderer  canvas to use for rendering
         */
        ImageDescriptor.prototype.render = function (canvasRenderer) {
            if (this.profiler != undefined) {
                this.profiler.startAccumulated('ImageDescriptor.render');
            }
            canvasRenderer.updateOpacity(this.opacity);
            canvasRenderer.updateBlendMode(this.blendMode);
            canvasRenderer.getCanvas().drawImage(this.image, this.sourceX, this.sourceY, this.sourceWidth, this.sourceHeight, this.destWidth, this.destHeight);
            if (this.profiler != undefined) {
                this.profiler.stopAccumulated('ImageDescriptor.render');
            }
        };
        /**
         * Called to get the rendering transform
         */
        ImageDescriptor.prototype.getTransform = function () {
            return this.mtx;
        };
        /**
         * Checks to see if pixel snapping should be applied when rendering
         */
        ImageDescriptor.prototype.snapToPixel = function () {
            return this.pixelSnap;
        };
        return ImageDescriptor;
    })();
    exports.ImageDescriptor = ImageDescriptor;
    var ImageAnimator = (function () {
        function ImageAnimator(actor) {
            this.actor = actor;
            this.frameHead = 0;
            this.framePeriod = 1 / 16;
            this.endMode = 0 /* Stop */;
            this.tween = new TweenMax({}, 0, {});
            this.onComplete = function (imageAnimator) {
            };
            this.onUpdate = function (imageAnimator, frame) {
            };
            actor.addComponent(this.getName(), this);
        }
        ImageAnimator.prototype.setOnComplete = function (onComplete) {
            this.onComplete = onComplete;
        };
        ImageAnimator.prototype.setOnUpdate = function (onUpdate) {
            this.onUpdate = onUpdate;
        };
        ImageAnimator.prototype.play = function (repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(0, this.getFrameCount() - 1, repeatCount, yoyo);
        };
        ImageAnimator.prototype.playFrom = function (startFrame, repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(startFrame, this.getFrameCount() - 1, repeatCount, yoyo);
        };
        ImageAnimator.prototype.playTo = function (endFrame, repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(this.getFrame(), endFrame, repeatCount, yoyo);
        };
        ImageAnimator.prototype.playFromTo = function (startFrame, endFrame, repeatCount, yoyo) {
            var _this = this;
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.setFrame(startFrame);
            this.tween = TweenMax.fromTo(this, this.calcAnimTime(startFrame, endFrame), { frameHead: startFrame }, { ease: Linear.easeNone, frameHead: endFrame, repeat: repeatCount, repeatDelay: this.framePeriod, yoyo: yoyo, onComplete: function () { return _this.handleComplete(); }, onUpdate: function () { return _this.handleUpdate(); } });
        };
        ImageAnimator.prototype.stop = function (reset, hide) {
            if (reset === void 0) { reset = false; }
            if (hide === void 0) { hide = false; }
            if (reset)
                this.tween.pause(0);
            else
                this.tween.pause();
            if (hide)
                this.actor.getComponents().Transform.setVisible(false);
        };
        ImageAnimator.prototype.resume = function () {
            this.tween.resume();
        };
        ImageAnimator.prototype.togglePlaying = function () {
            this.tween.paused(!this.tween.paused());
        };
        ImageAnimator.prototype.calcAnimTime = function (startFrame, endFrame) {
            return Math.abs(endFrame - startFrame) * this.framePeriod;
        };
        ImageAnimator.prototype.handleComplete = function () {
            switch (this.endMode) {
                case 1 /* Reset */:
                    {
                        //Go back to start frame of tween
                        this.tween.pause(0);
                    }
                    break;
                case 2 /* Hide */:
                    {
                        this.actor.getComponents().Transform.setVisible(false);
                    }
                    break;
            }
            this.onComplete(this);
        };
        ImageAnimator.prototype.handleUpdate = function () {
            var frame = Math.max(0, Math.floor(this.frameHead));
            this.actor.getComponents().ImageSequence.setFrame(frame);
            this.onUpdate(this, frame);
        };
        ImageAnimator.prototype.setEndMode = function (mode) {
            this.endMode = mode;
        };
        ImageAnimator.prototype.setFramerate = function (rate) {
            if (rate > 0)
                this.framePeriod = 1 / rate;
            else
                this.framePeriod = 0;
        };
        ImageAnimator.prototype.setFrame = function (frame) {
            this.frameHead = frame;
            this.actor.getComponents().ImageSequence.setFrame(frame);
        };
        ImageAnimator.prototype.isPlaying = function () {
            return !this.tween.paused();
        };
        ImageAnimator.prototype.getFramerate = function () {
            return this.framePeriod != 0 ? 1 / this.framePeriod : 0;
        };
        ImageAnimator.prototype.getFramePeriod = function () {
            return this.framePeriod;
        };
        ImageAnimator.prototype.getFrame = function () {
            return this.actor.getComponents().ImageSequence.getFrame();
        };
        ImageAnimator.prototype.getFrameHead = function () {
            return this.frameHead;
        };
        ImageAnimator.prototype.getFrameCount = function () {
            return this.actor.getComponents().ImageSequence.getFrameCount();
        };
        // IComponent
        ImageAnimator.prototype.getActor = function () {
            return this.actor;
        };
        ImageAnimator.prototype.getName = function () {
            return exports.Components.ImageAnimator;
        };
        return ImageAnimator;
    })();
    exports.ImageAnimator = ImageAnimator;
    /**
     * @file RectangleDescriptor.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Descriptor used to render rectangles
     */
    var RectangleDescriptor = (function () {
        /**
         * Create a new RectangleDescriptor
         */
        function RectangleDescriptor() {
            this.resetDefaults();
            this.mtx = new Matrix2d();
        }
        /**
         * Set a profiler object to use
         *
         * @param  profiler  profiler object
         */
        RectangleDescriptor.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
        };
        /**
         * Reset all values
         */
        RectangleDescriptor.prototype.resetDefaults = function () {
            this.opacity = 1;
            this.fill = true;
            this.color = '#000000';
            this.lineWidth = 1;
            this.width = 0;
            this.height = 0;
            this.blendMode = 'source-over';
        };
        /**
         * Called to render
         *
         * @param  canvasRenderer  canvas to use for rendering
         */
        RectangleDescriptor.prototype.render = function (canvasRenderer) {
            if (this.profiler != undefined) {
                this.profiler.startAccumulated('RectangleDescriptor.render');
            }
            canvasRenderer.updateOpacity(this.opacity);
            canvasRenderer.updateBlendMode(this.blendMode);
            if (this.fill) {
                canvasRenderer.updateFill(this.color);
                canvasRenderer.getCanvas().drawFillRectangle(this.width, this.height);
            }
            else {
                canvasRenderer.updateStroke(this.color);
                canvasRenderer.updateLineWidth(this.lineWidth);
                canvasRenderer.getCanvas().drawRectangle(this.width, this.height);
            }
            if (this.profiler != undefined) {
                this.profiler.stopAccumulated('RectangleDescriptor.render');
            }
        };
        /**
         * Called to get the rendering transform
         */
        RectangleDescriptor.prototype.getTransform = function () {
            return this.mtx;
        };
        /**
         * Checks to see if pixel snapping should be applied when rendering
         */
        RectangleDescriptor.prototype.snapToPixel = function () {
            return false;
        };
        return RectangleDescriptor;
    })();
    exports.RectangleDescriptor = RectangleDescriptor;
    /**
     * @file Canvas.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * @class
     *
     * Represents a Canvas element in the DOM
     */
    var Canvas = (function () {
        /**
         * Create Canvas object
         *
         * @param  parentDiv  the parent div object the canvas is on
         * @param  width  width in pixels of the canvas
         * @param  height  height in pixels of the canvas
         */
        function Canvas(parentDiv, width, height) {
            this.responsive = false;
            this.fitWindow = false;
            this.parentDiv = parentDiv;
            if (parentDiv != undefined && parentDiv != null) {
                this.canvasDiv = document.createElement('div');
                this.canvasDiv.className = 'game-canvas-div';
                this.canvasDiv.style.position = 'absolute';
                this.canvasDiv.style.overflow = 'hidden';
                this.canvasDiv.style.width = '100%';
                this.canvasDiv.style.height = '100%';
            }
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'game-canvas';
            this.canvas.style.position = 'absolute';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            if (width != undefined) {
                this.canvas.width = width;
            }
            if (height != undefined) {
                this.canvas.height = height;
            }
            this.context = this.canvas.getContext('2d');
            if (parentDiv != undefined && parentDiv != null) {
                this.canvasDiv.appendChild(this.canvas);
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
         * Get the associated canvas
         */
        Canvas.prototype.getCanvas = function () {
            return this.canvas;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        Canvas.prototype.getWidth = function () {
            return this.canvas.width;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        Canvas.prototype.getHeight = function () {
            return this.canvas.height;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        Canvas.prototype.getResponsiveScaleX = function () {
            return this.responsiveScaleX;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        Canvas.prototype.getResponsiveScaleY = function () {
            return this.responsiveScaleY;
        };
        /**
         * Setup the canvas to be responsize
         */
        Canvas.prototype.enableResponsiveScaling = function () {
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
        Canvas.prototype.fitToWindow = function () {
            var _this = this;
            this.fitWindow = true;
            TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            this.handleResponsive();
        };
        /**
         * Clear the entire canvas
         */
        Canvas.prototype.clear = function () {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        };
        /**
         * Set the visibility of the canvas in the DOM
         *
         * @param  visible  true if canvas should be visible
         */
        Canvas.prototype.setVisible = function (visible) {
            this.canvas.style.display = visible ? 'block' : 'none';
        };
        /**
         * Set the dimensions of the canvas in percentage
         *
         * @param  paddingX  normalized padding percentage on the X
         * @param  paddingY  normalized padding percentage on the Y
         */
        Canvas.prototype.setResponsivePadding = function (paddingX, paddingY) {
            this.responsivePaddingX = paddingX;
            this.responsivePaddingY = paddingY;
            this.handleResponsive();
        };
        /**
         * Set the z index of the canvas in the DOM
         *
         * @param  z  the z index in the DOM
         */
        Canvas.prototype.setZOrder = function (z) {
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
        Canvas.prototype.setSize = function (width, height) {
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
        Canvas.prototype.setSizePercent = function (width, height) {
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
        Canvas.prototype.setPosition = function (x, y) {
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
        Canvas.prototype.setPositionPercent = function (x, y) {
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
         * Set the current transform on the canvas
         *
         * @param  m11  11 component
         * @param  m12  12 component
         * @param  m21  21 component
         * @param  m22  22 component
         * @param  tx  x translation component
         * @param  ty  y translation component
         */
        Canvas.prototype.setTransform = function (m11, m12, m21, m22, tx, ty) {
            this.context.setTransform(m11, m12, m21, m22, tx, ty);
        };
        /**
         * Scale the transform on the canvas
         *
         * @param  scalex  scale on the x
         * @param  scaley  scale on the y
         */
        Canvas.prototype.scale = function (scalex, scaley) {
            this.context.scale(scalex, scaley);
        };
        /**
         * Set the current canvas opacity
         *
         * @param  opacity  opacity level from 0..1
         */
        Canvas.prototype.setOpacity = function (opacity) {
            this.context.globalAlpha = opacity;
        };
        /**
         * Set the current canvas blend mode
         *
         * @param  mode  blend mode
         */
        Canvas.prototype.setBlendMode = function (mode) {
            this.context.globalCompositeOperation = mode;
        };
        /**
         * Setup a clipping path
         *
         * @param  x  x coordinate of clipping path
         * @param  y  y coordinate of clipping path
         * @param  w  width of clipping path
         * @param  h  height of clipping path
         */
        Canvas.prototype.setClipPath = function (x, y, w, h) {
            this.context.save();
            this.context.beginPath();
            this.context.rect(x, y, w, h);
            this.context.clip();
        };
        /**
         * Ends a clipping path that was setup previously
         */
        Canvas.prototype.endClipPath = function () {
            this.context.restore();
        };
        /**
         * Set the current stroke style
         *
         * @param  color  color of the line stroke
         */
        Canvas.prototype.setStrokeStyle = function (color) {
            this.context.strokeStyle = color;
        };
        /**
         * Set the current stroke style using a gradient
         *
         * @param  gradient  color gradient
         */
        Canvas.prototype.setGradientStrokeStyle = function (gradient) {
            this.context.strokeStyle = gradient;
        };
        /**
         * Set the current fill style
         *
         * @param  color  color of the fill
         */
        Canvas.prototype.setFillStyle = function (color) {
            this.context.fillStyle = color;
        };
        /**
         * Set the current fill style using a gradient
         *
         * @param  gradient  color gradient
         */
        Canvas.prototype.setGradientFillStyle = function (gradient) {
            this.context.fillStyle = gradient;
        };
        /**
         * Set the current line width of the stroke
         *
         * @param  width  width in pixels of stroke
         */
        Canvas.prototype.setLineWidth = function (width) {
            this.context.lineWidth = width;
        };
        /**
         * Sets the properties needed for text rendering
         *
         * @param  font  the text CSS font string
         * @param  baseline  vertical alignment
         * @param  align  horizontal alignment
         * @param  joints  specifies the type of joints that should be used where two lines meet.
         *                 (optional) [ "bevel", "round", "miter" ]
         * @param  miterLimit  if joints is set to "miter", then you can specify a miter limit
         *                     ratio which controls at what point a mitered joint will be clipped.
         */
        Canvas.prototype.setTextProperties = function (font, baseline, align, joints, miterLimit) {
            this.context.font = font;
            this.context.textBaseline = baseline;
            this.context.textAlign = align;
            this.context.lineJoin = joints;
            this.context.miterLimit = miterLimit;
        };
        /**
         * Sets the properties needed for text shadows
         *
         * @param  offsetX  shadow offset on the x
         * @param  offsetY  shadow offset on the y
         * @param  color  shadow color CSS value
         * @param  blur  shadow blur factor
         */
        Canvas.prototype.setTextShadowProperties = function (offsetX, offsetY, color, blur) {
            this.context.shadowOffsetX = offsetX;
            this.context.shadowOffsetY = offsetY;
            this.context.shadowColor = color;
            this.context.shadowBlur = blur;
        };
        /**
         * Create a linear gradient
         *
         * @param  gradPositions  the gradient positions
         */
        Canvas.prototype.createLinearGradient = function (gradPositions) {
            return this.context.createLinearGradient(gradPositions[0], gradPositions[1], gradPositions[2], gradPositions[3]);
        };
        /**
         * Draw a rectangle
         *
         * @param  width  width of rectangle
         * @param  height  height of rectangle
         */
        Canvas.prototype.drawRectangle = function (width, height) {
            this.context.strokeRect(0, 0, width, height);
        };
        /**
         * Draw a fill rectangle
         *
         * @param  width  width of rectangle
         * @param  height  height of rectangle
         */
        Canvas.prototype.drawFillRectangle = function (width, height) {
            this.context.fillRect(0, 0, width, height);
        };
        /**
         * Draw an image
         *
         * @param  img  image to draw on canvas
         * @param  srcx  source x coord
         * @param  srcy  source y coord
         * @param  srcw  source width
         * @param  srch  source height
         * @param  destw  destination width
         * @param  desth  destination height
         */
        Canvas.prototype.drawImage = function (img, srcx, srcy, srcw, srch, destw, desth) {
            this.context.drawImage(img, srcx, srcy, srcw, srch, 0, 0, destw, desth);
        };
        Canvas.prototype.drawTextureMap = function (img, pts) {
            var tris = [[0, 1, 2], [2, 3, 0]]; // Split in two triangles
            var t;
            for (t = 0; t < 2; t++) {
                var pp = tris[t];
                var x0 = pts[pp[0]].x, x1 = pts[pp[1]].x, x2 = pts[pp[2]].x;
                var y0 = pts[pp[0]].y, y1 = pts[pp[1]].y, y2 = pts[pp[2]].y;
                var u0 = pts[pp[0]].u, u1 = pts[pp[1]].u, u2 = pts[pp[2]].u;
                var v0 = pts[pp[0]].v, v1 = pts[pp[1]].v, v2 = pts[pp[2]].v;
                // Set clipping area so that only pixels inside the triangle will
                // be affected by the image drawing operation
                this.context.save();
                this.context.beginPath();
                this.context.moveTo(x0, y0);
                this.context.lineTo(x1, y1);
                this.context.lineTo(x2, y2);
                this.context.closePath();
                this.context.clip();
                // Compute matrix transform
                var delta = u0 * v1 + v0 * u2 + u1 * v2 - v1 * u2 - v0 * u1 - u0 * v2;
                var delta_a = x0 * v1 + v0 * x2 + x1 * v2 - v1 * x2 - v0 * x1 - x0 * v2;
                var delta_b = u0 * x1 + x0 * u2 + u1 * x2 - x1 * u2 - x0 * u1 - u0 * x2;
                var delta_c = u0 * v1 * x2 + v0 * x1 * u2 + x0 * u1 * v2 - x0 * v1 * u2 - v0 * u1 * x2 - u0 * x1 * v2;
                var delta_d = y0 * v1 + v0 * y2 + y1 * v2 - v1 * y2 - v0 * y1 - y0 * v2;
                var delta_e = u0 * y1 + y0 * u2 + u1 * y2 - y1 * u2 - y0 * u1 - u0 * y2;
                var delta_f = u0 * v1 * y2 + v0 * y1 * u2 + y0 * u1 * v2 - y0 * v1 * u2 - v0 * u1 * y2 - u0 * y1 * v2;
                // Draw the transformed image
                // Hello silly ordered parameters
                //            scalex           skewx            skewy            scaley           posx             posy
                this.context.transform(delta_a / delta, delta_d / delta, delta_b / delta, delta_e / delta, delta_c / delta, delta_f / delta);
                this.context.drawImage(img, 0, 0);
                this.context.restore();
            }
        };
        /**
         * Draw some text
         *
         * @param  text  text to draw on canvas
         * @param  x  x position on canvas
         * @param  y  y position on canvas
         * @param  maxWidth  maximum width to draw text
         */
        Canvas.prototype.drawText = function (text, x, y, maxWidth) {
            this.context.strokeText(text, x, y, maxWidth);
        };
        /**
         * Draw some filled text
         *
         * @param  text  text to draw on canvas
         * @param  x  x position on canvas
         * @param  y  y position on canvas
         * @param  maxWidth  maximum width to draw text
         */
        Canvas.prototype.drawFillText = function (text, x, y, maxWidth) {
            this.context.fillText(text, x, y, maxWidth);
        };
        /**
         * Measure the width of a text string
         *
         * @param  text  text to measure
         */
        Canvas.prototype.measureText = function (text) {
            return this.context.measureText(text).width;
        };
        /**
         * Handles the tick event from GSAP
         *
         * @param  tickerEvent  contains time info
         */
        Canvas.prototype.handleTick = function (tickerEvent) {
            this.checkResponsiveTime += tickerEvent.target.time;
            if (this.checkResponsiveTime >= this.checkResponsiveTimeout) {
                this.checkResponsiveTime = 0;
                this.checkWindowSize();
            }
        };
        /**
         * Check to see window size has changed so we can respond
         */
        Canvas.prototype.checkWindowSize = function () {
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
         * IFrame orientation issue fix Private to public
         */
        Canvas.prototype.handleResponsive = function () {
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
        return Canvas;
    })();
    exports.Canvas = Canvas;
    /**
     * @file FrameAnimator.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    (function (AnimationEndMode) {
        AnimationEndMode[AnimationEndMode["Stop"] = 0] = "Stop";
        AnimationEndMode[AnimationEndMode["Reset"] = 1] = "Reset";
        AnimationEndMode[AnimationEndMode["Hide"] = 2] = "Hide";
    })(exports.AnimationEndMode || (exports.AnimationEndMode = {}));
    var AnimationEndMode = exports.AnimationEndMode;
    /**
     * Component to handle animation of frame based 2d images
     */
    var FrameAnimator = (function () {
        /**
         * Create a new FrameAnimator object
         *
         * @param  actor  actor that owns the component
         */
        function FrameAnimator(actor) {
            this.actor = actor;
            this.frameHead = 0;
            this.framePeriod = 1 / 16;
            this.tween = new TweenMax({}, 0, {});
            this.endMode = 0 /* Stop */;
            this.onComplete = function (frameAnimator) {
            };
            this.onUpdate = function (frameAnimator, frame) {
            };
            actor.addComponent(this.getName(), this);
        }
        /**
         * Set the callback called when the animation completes
         *
         * @param  onComplete  function called when the animation completes
         */
        FrameAnimator.prototype.setOnComplete = function (onComplete) {
            this.onComplete = onComplete;
        };
        /**
         * Set the callback called when the animation updates
         *
         * @param  onUpdate  function called when the animation updates
         */
        FrameAnimator.prototype.setOnUpdate = function (onUpdate) {
            this.onUpdate = onUpdate;
        };
        /**
         * Play all frames of an animation
         *
         * @param  repeatCount  number of times to repeat animation after first playthrough
         * @param  yoyo:        true to reverse direction on every repeat
         */
        FrameAnimator.prototype.play = function (repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(0, this.getFrameCount() - 1, repeatCount, yoyo);
        };
        /**
         * Play an animation from startFrame to last frame
         *
         * @param  startFrame   first frame of animation
         * @param  repeatCount  number of times to repeat animation after first playthrough
         * @param  yoyo:        true to reverse direction on every repeat
         */
        FrameAnimator.prototype.playFrom = function (startFrame, repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(startFrame, this.getFrameCount() - 1, repeatCount, yoyo);
        };
        /**
         * Play an animation from current frame to endFrame
         *
         * @param  endFrame     last frame of animation
         * @param  repeatCount  number of times to repeat animation after first playthrough
         * @param  yoyo:        true to reverse direction on every repeat
         */
        FrameAnimator.prototype.playTo = function (endFrame, repeatCount, yoyo) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.playFromTo(this.getFrame(), endFrame, repeatCount, yoyo);
        };
        /**
         * Play an animation from startFrame to endFrame
         *
         * @param  startFrame   first frame of animation
         * @param  endFrame     last frame of animation
         * @param  repeatCount  number of times to repeat animation after first playthrough
         * @param  yoyo:        true to reverse direction on every repeat
         */
        FrameAnimator.prototype.playFromTo = function (startFrame, endFrame, repeatCount, yoyo) {
            var _this = this;
            if (repeatCount === void 0) { repeatCount = 0; }
            if (yoyo === void 0) { yoyo = false; }
            this.setFrame(startFrame);
            this.tween = TweenMax.fromTo(this, this.calcAnimTime(startFrame, endFrame), { frameHead: startFrame }, { ease: Linear.easeNone, frameHead: endFrame, repeat: repeatCount, repeatDelay: this.framePeriod, yoyo: yoyo, onComplete: function () { return _this.handleComplete(); }, onUpdate: function () { return _this.handleUpdate(); } });
        };
        /**
         * Stop animation immediately
         *
         * @param  reset  true to set frame to first frame of current animation
         * @param  hide   true to hide image
         */
        FrameAnimator.prototype.stop = function (reset, hide) {
            if (reset === void 0) { reset = false; }
            if (hide === void 0) { hide = false; }
            if (reset)
                this.tween.pause(0);
            else
                this.tween.pause();
            if (hide)
                this.actor.getComponents().Transform.setVisible(false);
        };
        /**
         * Resume the current animation from its current position
         */
        FrameAnimator.prototype.resume = function () {
            this.tween.resume();
        };
        /**
         * Resume if paused. Stop if playing.
         */
        FrameAnimator.prototype.togglePlaying = function () {
            this.tween.paused(!this.tween.paused());
        };
        /**
         * Calculate amount of time an animation will take at the current framerate
         *
         * @param  startFrame  starting frame number
         * @param  endFrame    ending frame number
         */
        FrameAnimator.prototype.calcAnimTime = function (startFrame, endFrame) {
            return Math.abs(endFrame - startFrame) * this.framePeriod;
        };
        /**
         * Handle event thrown every time an animation is completely finished
         */
        FrameAnimator.prototype.handleComplete = function () {
            switch (this.endMode) {
                case 1 /* Reset */:
                    {
                        //Go back to start frame of tween
                        this.tween.pause(0);
                    }
                    break;
                case 2 /* Hide */:
                    {
                        this.actor.getComponents().Transform.setVisible(false);
                    }
                    break;
            }
            this.onComplete(this);
        };
        /**
         * Called to update the component on the frame tick
         */
        FrameAnimator.prototype.handleUpdate = function () {
            var frame = Math.max(0, Math.floor(this.frameHead));
            if (this.getActor().getName() == "transition") {
                console.log("found trnas 2");
            }
            this.actor.getComponents().Image.setFrame(frame);
            this.onUpdate(this, frame);
        };
        /**
         * Set the end mode
         *
         *
         * @param  mode  the end mode to use
         */
        FrameAnimator.prototype.setEndMode = function (mode) {
            this.endMode = mode;
        };
        /**
         * Set the framerate of the animation
         *
         * @param  rate  the framerate
         */
        FrameAnimator.prototype.setFramerate = function (rate) {
            if (rate > 0)
                this.framePeriod = 1 / rate;
            else
                this.framePeriod = 0;
        };
        /**
         * Set the current frame
         *
         * @param  frame  frame number to set
         */
        FrameAnimator.prototype.setFrame = function (frame) {
            this.frameHead = frame;
            this.actor.getComponents().Image.setFrame(frame);
        };
        /**
         * Report if there's an active animation
         */
        FrameAnimator.prototype.isPlaying = function () {
            return !this.tween.paused();
        };
        /**
         * Get the current framerate
         */
        FrameAnimator.prototype.getFramerate = function () {
            return this.framePeriod != 0 ? 1 / this.framePeriod : 0;
        };
        /**
         * Get the amount of time one frame will display
         */
        FrameAnimator.prototype.getFramePeriod = function () {
            return this.framePeriod;
        };
        /**
         * Get the current frame number that is being used
         */
        FrameAnimator.prototype.getFrame = function () {
            return this.actor.getComponents().Image.getFrame();
        };
        /**
         * Get the current position of the frame head
         */
        FrameAnimator.prototype.getFrameHead = function () {
            return this.frameHead;
        };
        /**
         * Get the frame count of the sprite sheet that is being used
         */
        FrameAnimator.prototype.getFrameCount = function () {
            return this.actor.getComponents().Image.getFrameCount();
        };
        /**
         * Get the actor that owns the component
         */
        FrameAnimator.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        FrameAnimator.prototype.getName = function () {
            return exports.Components.FrameAnimator;
        };
        return FrameAnimator;
    })();
    exports.FrameAnimator = FrameAnimator;
    /**
     * @file Rect.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Rectangular region container
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
            var v = new Vector2();
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
            return ((this.x == r.x) && (this.y == r.y) && (this.width == r.width) && (this.height == r.height));
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
            return ((this.width > MathUtil.EPSILON) && (this.height > MathUtil.EPSILON));
        };
        return Rect;
    })();
    exports.Rect = Rect;
    /**
     * @file Alignment.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    (function (HorizontalAlignment) {
        HorizontalAlignment[HorizontalAlignment["Left"] = 0] = "Left";
        HorizontalAlignment[HorizontalAlignment["Right"] = 1] = "Right";
        HorizontalAlignment[HorizontalAlignment["Center"] = 2] = "Center";
    })(exports.HorizontalAlignment || (exports.HorizontalAlignment = {}));
    var HorizontalAlignment = exports.HorizontalAlignment;
    (function (VerticalAlignment) {
        VerticalAlignment[VerticalAlignment["Top"] = 0] = "Top";
        VerticalAlignment[VerticalAlignment["Bottom"] = 1] = "Bottom";
        VerticalAlignment[VerticalAlignment["Center"] = 2] = "Center";
    })(exports.VerticalAlignment || (exports.VerticalAlignment = {}));
    var VerticalAlignment = exports.VerticalAlignment;
    (function (Alignment) {
        Alignment[Alignment["TopLeft"] = 0] = "TopLeft";
        Alignment[Alignment["TopCenter"] = 1] = "TopCenter";
        Alignment[Alignment["TopRight"] = 2] = "TopRight";
        Alignment[Alignment["BottomRight"] = 3] = "BottomRight";
        Alignment[Alignment["BottomCenter"] = 4] = "BottomCenter";
        Alignment[Alignment["BottomLeft"] = 5] = "BottomLeft";
        Alignment[Alignment["Center"] = 6] = "Center";
    })(exports.Alignment || (exports.Alignment = {}));
    var Alignment = exports.Alignment;
    (function (TextDirection) {
        TextDirection[TextDirection["Horizontal"] = 0] = "Horizontal";
        TextDirection[TextDirection["Vertical"] = 1] = "Vertical";
    })(exports.TextDirection || (exports.TextDirection = {}));
    var TextDirection = exports.TextDirection;
    /**
     * @file Text.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Component to handle rendering text
     */
    var Text = (function () {
        /**
         * Create a new Text object
         *
         * @param  actor  actor that owns the component
         * @param  transform  transform component needed during runtime
         * @param  canvas  canvas to use for text rendering
         */
        function Text(actor) {
            this.transform = actor.getTransform();
            this.canvas = new Canvas();
            this.actor = actor;
            this.visible = true;
            this.textScale = 1;
            this.opacity = 1;
            this.text = "";
            this.font = "12px arial";
            this.maxLineWidth = null;
            this.lineHeight = 0;
            this.scalar = 1;
            this.joints = "round";
            this.miterLimit = 2;
            this.setHorizontalAlign(0 /* Left */);
            this.setVerticalAlign(0 /* Top */);
            this.setTextDirection(0 /* Horizontal */);
            this.dirty = true;
            this.textWidth = 0;
            this.textHeight = 0;
            this.effects = new Array();
            this.lines = [];
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        /**
         * Set the scaling factor used when drawing text
         *
         * @param  scale  scaling factor
         */
        Text.prototype.setTextScale = function (scale) {
            this.textScale = scale;
            this.dirty = true;
        };
        /**
         * Get the scaling factor used when drawing text
         */
        Text.prototype.getTextScale = function () {
            return this.textScale;
        };
        /**
         * Set the rendering opacity of the text
         *
         * @param  opacity  opacity level [0...1]
         */
        Text.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
            this.dirty = true;
        };
        /**
         * Get the rendering opacity of the text
         */
        Text.prototype.getOpacity = function () {
            return this.opacity;
        };
        /**
         * Set the text visibility
         *
         * @param  visible  true if text is visible (local)
         */
        Text.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the local visibility of the text
         */
        Text.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the text value
         *
         * @param  text  value of the text displayed
         */
        Text.prototype.setText = function (text) {
            if (text != this.text) {
                this.text = text;
                this.dirty = true;
            }
        };
        /**
         * Get the value of the text
         */
        Text.prototype.getText = function () {
            return this.text;
        };
        /**
         * Set the text font
         *
         * @param  font  text font
         */
        Text.prototype.setFont = function (font) {
            this.font = font;
            this.dirty = true;
        };
        /**
         * Get the text font
         */
        Text.prototype.getFont = function () {
            return this.font;
        };
        /**
         * Set the alignment
         *
         * @param  align  alignment
         */
        Text.prototype.setAlign = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(2 /* Center */);
                    break;
            }
        };
        /**
         * Set the text horizontal alignment
         *
         * @param  align  horizontal alignment
         */
        Text.prototype.setHorizontalAlign = function (align) {
            this.horzAlign = align;
        };
        /**
         * Get the horizontal alignment
         */
        Text.prototype.getHorizontalAlign = function () {
            return this.horzAlign;
        };
        /**
         * Set the text vertical alignment
         *
         * @param  align  vertical alignment
         */
        Text.prototype.setVerticalAlign = function (align) {
            this.vertAlign = align;
        };
        /**
         * Get the vertical alignment
         */
        Text.prototype.getVerticalAlign = function () {
            return this.vertAlign;
        };
        /**
         * Set the text draw direction
         * @param {TextDirection} direction The draw direction
         */
        Text.prototype.setTextDirection = function (direction) {
            this.textDirection = direction;
        };
        /**
         * Get the text draw direction
         * @returns {TextDirection} The draw direction
         */
        Text.prototype.getTextDirection = function () {
            return this.textDirection;
        };
        /**
         * Set the maximum width of each line of text
         *
         * @param  lineWidth  width in pixels on a line of text
         */
        Text.prototype.setMaxLineWidth = function (maxLineWidth) {
            this.maxLineWidth = maxLineWidth;
            this.dirty = true;
        };
        /**
         * Get the width of a single line of text in pixels
         */
        Text.prototype.getMaxLineWidth = function () {
            return this.maxLineWidth;
        };
        /**
         * Set the height of each line of text
         *
         * @param  lineHeight  height in pixels on a line of text
         */
        Text.prototype.setLineHeight = function (lineHeight) {
            this.lineHeight = lineHeight;
            this.dirty = true;
        };
        /**
         * Get the height of a single line of text in pixels
         */
        Text.prototype.getLineHeight = function () {
            return this.lineHeight;
        };
        /**
         * Set the way that text joints are joined [ "bevel", "round", "miter" ]
         *
         * @param  lineJoin  the line joint setting
         */
        Text.prototype.setLineJoin = function (lineJoin) {
            this.joints = lineJoin;
        };
        /**
         * Get the way that text joints are joined
         */
        Text.prototype.getLineJoin = function () {
            return this.joints;
        };
        /**
         * Set the miter limit ratio which controls at what point a mitered joint will be clipped.
         *
         * @param  miterLimit  the miter limit setting
         */
        Text.prototype.setMiterLimit = function (miterLimit) {
            this.miterLimit = miterLimit;
        };
        /**
         * Get the miter limit ratio
         */
        Text.prototype.getMiterLimit = function () {
            return this.miterLimit;
        };
        /**
         * Set the dirty flag to force text to refresh on next render
         */
        Text.prototype.setDirty = function () {
            this.dirty = true;
        };
        /**
         * Set the scale factor for the text
         * @method abg2d.Text#setScale
         * @public
         * @param {number} scalar The scale factor
         */
        Text.prototype.setScalar = function (scalar) {
            this.scalar = scalar;
        };
        /**
         * Call to add an effect to the list of effects used to render the text
         *
         * @param  effect  the effect to add
         */
        Text.prototype.addEffect = function (effect) {
            this.effects.push(effect);
        };
        /**
         * Get an effect by index
         *
         * @param  index  the add index of the effect
         */
        Text.prototype.getEffect = function (index) {
            return this.effects[index];
        };
        /**
         * Call to have the text redraw to its backing canvas. This will make sure the text
         * is drawn and ready to use on the next render call.
         */
        Text.prototype.refresh = function () {
            if (this.dirty) {
                this.dirty = false;
                this.lines = [];
                if (this.textDirection == 0 /* Horizontal */) {
                    this.populateText();
                }
                else {
                    this.populateVerticalText();
                }
                this.calculateTextDimensions();
                var w = Math.round(this.getWidth() * this.textScale);
                var h = Math.round(this.getHeight() * this.textScale);
                if (this.canvas.getWidth() != w || this.canvas.getHeight() != h) {
                    this.canvas.setSize(w, h);
                }
                this.canvas.setTransform(1, 0, 0, 1, 0, 0);
                this.canvas.clear();
                this.draw();
                this.updateRenderTransform();
            }
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        Text.prototype.render = function (cr) {
            this.refresh();
            var canvas = this.canvas.getCanvas();
            if (canvas.width > 0 && canvas.height > 0) {
                cr.drawImage(this.transform.getXfm(), canvas, 0, 0, canvas.width, canvas.height, canvas.width, canvas.height, this.opacity, true);
            }
        };
        /**
         * Get the actor who owns the component
         */
        Text.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        Text.prototype.getName = function () {
            return exports.Components.Text;
        };
        /**
         * Check the visibility of the renderable
         */
        Text.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        /**
         * Get the z rendering order of the renderable
         */
        Text.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Get the width of the renderable area
         */
        Text.prototype.getWidth = function () {
            if (this.textWidth == 0) {
                this.calculateTextDimensions();
            }
            return this.textWidth;
        };
        /**
         * Get the height of the renderable area
         */
        Text.prototype.getHeight = function () {
            if (this.textHeight == 0) {
                this.calculateTextDimensions();
            }
            return this.textHeight;
        };
        /**
         * Get the rendering width of the renderable area
         */
        Text.prototype.getDrawWidth = function () {
            return this.textWidth;
        };
        /**
         * Get the rendering height of the renderable area
         */
        Text.prototype.getDrawHeight = function () {
            return this.textHeight;
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Text.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(), this.getHeight());
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Text.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(), this.getDrawHeight());
        };
        /**
         * Called to update the rendering transform with new alignment, etc..
         */
        Text.prototype.updateRenderTransform = function () {
            switch (this.horzAlign) {
                case 0 /* Left */:
                    this.transform.setPivotX(0);
                    break;
                case 2 /* Center */:
                    var pivot = this.textWidth * 0.5 * this.textScale;
                    this.transform.setPivotX(pivot);
                    break;
                case 1 /* Right */:
                    var pivot = this.textWidth * this.textScale;
                    this.transform.setPivotX(pivot);
                    break;
            }
            switch (this.vertAlign) {
                case 0 /* Top */:
                    this.transform.setPivotY(0);
                    break;
                case 2 /* Center */:
                    var pivot = this.textHeight * 0.5 * this.textScale;
                    this.transform.setPivotY(pivot);
                    break;
                case 1 /* Bottom */:
                    var pivot = this.textHeight * this.textScale;
                    this.transform.setPivotY(pivot);
                    break;
            }
            if (this.scalar != 1) {
                this.transform.setScale(this.scalar, this.scalar);
            }
            this.transform.invalidate();
        };
        /**
         * Get the measured text width, without wrapping
         */
        Text.prototype.getMeasuredWidth = function () {
            return this.canvas.measureText(this.text);
        };
        /**
         * Get the measured text line height
         * @method abg2d.Text#getMeasuredLineHeight
         * @private
         * @param {number} lineNumber The line number to measure
         * @returns {number} The measured height
         */
        Text.prototype.getMeasuredLineHeight = function (lineNumber) {
            //TS limitation: it does not include the font prop on span tags so we have to cast to any...
            var text = document.createElement("span");
            text.font = this.font;
            text.textContent = this.text;
            document.body.appendChild(text);
            /**
             * Replace text.offsetHeight to (parseInt(this.font, 0) for fixing line space issue
             */
            var height = (parseInt(this.font, 0) + parseInt(this.font, 0) * this.lineHeight) * Math.max(1, lineNumber);
            document.body.removeChild(text);
            return height;
        };
        /**
         * Populates lines of text
         * @method abg2d.Text#populateText
         * @private
         */
        Text.prototype.populateText = function () {
            this.canvas.setTextProperties(this.font, "middle", "left", this.joints, this.miterLimit);
            var words = this.text.split(" ");
            var currentLine = words[0];
            var length = words.length;
            for (var i = 1; i < length; i++) {
                var word = words[i];
                var width = this.canvas.measureText(currentLine + " " + word);
                if (this.maxLineWidth == null || width < this.maxLineWidth) {
                    currentLine += " " + word;
                }
                else {
                    this.lines.push(currentLine);
                    currentLine = word;
                }
            }
            this.lines.push(currentLine);
        };
        /**
         * Populates lines of text vertically
         * @method abg2d.Text#populateVerticalText
         * @private
         */
        Text.prototype.populateVerticalText = function () {
            this.canvas.setTextProperties(this.font, "middle", "left", this.joints, this.miterLimit);
            var words = this.text.split("");
            var length = words.length;
            for (var i = 0; i < length; i++) {
                this.lines.push(words[i]);
            }
        };
        /**
         * Calculates the width and height of the text to render
         * @method abg2d.Text#calculateTextDimensions
         * @private
         */
        Text.prototype.calculateTextDimensions = function () {
            var lineLength = this.lines.length;
            if (lineLength > 0) {
                if (this.textDirection == 0 /* Horizontal */) {
                    this.textWidth = (this.maxLineWidth != null) ? this.maxLineWidth : this.canvas.measureText(this.text);
                }
                else {
                    this.textWidth = this.canvas.measureText("M");
                }
            }
            else {
                this.textWidth = this.canvas.measureText(this.text);
            }
            this.textHeight = this.getMeasuredLineHeight(lineLength);
        };
        /**
         * Draw text to the backing canvas
         * @method abg2d.Text#draw
         * @private
         */
        Text.prototype.draw = function () {
            // Configure canvas text properties
            var TEXT_DRAW_BUFFER = 5;
            var canvasAlign = "left";
            var canvasOffset = TEXT_DRAW_BUFFER;
            if (this.horzAlign == 1 /* Right */) {
                canvasAlign = "right";
                canvasOffset = this.textWidth - TEXT_DRAW_BUFFER;
            }
            else if (this.horzAlign == 2 /* Center */) {
                canvasAlign = "center";
                canvasOffset = this.textWidth / 2;
            }
            this.canvas.setTextProperties(this.font, "middle", canvasAlign, this.joints, this.miterLimit);
            var length = this.lines.length;
            for (var i = 0; i < length; i++) {
                this.drawLine(this.lines[i], canvasOffset, this.getMeasuredLineHeight(i + 1) / 2);
            }
        };
        /**
         * Draw a line of text to the backing canvas
         * @method abg2d.Text#drawLine
         * @private
         * @param {string} text The text to draw
         * @param {number} drawPosX The position within the backing canvas to draw
         * @param {number} drawPosY The position within the backing canvas to draw
         */
        Text.prototype.drawLine = function (text, drawPosX, drawPosY) {
            var effect = null;
            for (var i = 0; i < this.effects.length; i++) {
                effect = this.effects[i];
                this.textWidth += effect.getExtendedTextWidth();
                this.textHeight += effect.getExtendedTextHeight();
                effect.render(this.canvas, text, ((0.5 + drawPosX) | 0), ((0.5 + drawPosY) | 0), this.textWidth, this.textHeight, this.textWidth, false);
            }
        };
        return Text;
    })();
    exports.Text = Text;
    /**
     * @file Vector2.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Two Dimensional vector container
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
            var theta = (new MathUtil()).toRadians(rotation);
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
            if ((new MathUtil()).fltCmp(this.length, 0))
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
            if ((new MathUtil()).fltCmp(this.length, 0) || (new MathUtil()).fltCmp(vec.getLength(), 0))
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
    exports.Vector2 = Vector2;
    /**
     * @file Box.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Component to handle 2d rendering 2d primitives
     */
    var Box = (function () {
        /**
         * Create a new Box object
         *
         * @param  actor  actor that owns the component
         */
        function Box(actor) {
            this.actor = actor;
            this.visible = true;
            this.transform = actor.getTransform();
            this.width = 0;
            this.height = 0;
            this.color = 'rgb(0,0,0)';
            this.opacity = 1;
            this.isFilled = true;
            this.lineWidth = 0;
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        /**
         * Set the width of the box
         *
         * @param  width  width in pixels of the box
         * @param  height  heign in pixels of the box
         */
        Box.prototype.setSize = function (width, height) {
            this.width = width;
            this.height = height;
        };
        /**
         * Set the width of the box
         *
         * @param  width  width in pixels of box
         */
        Box.prototype.setWidth = function (width) {
            this.width = width;
        };
        /**
         * Get the width of the renderable area
         */
        Box.prototype.getWidth = function () {
            return this.width;
        };
        /**
         * Set the height of the box
         *
         * @param  height  height in pixels of box
         */
        Box.prototype.setHeight = function (height) {
            this.height = height;
        };
        /**
         * Get the height of the renderable area
         */
        Box.prototype.getHeight = function () {
            return this.height;
        };
        /**
         * Get the rendering width of the renderable area
         */
        Box.prototype.getDrawWidth = function () {
            return this.width;
        };
        /**
         * Get the rendering height of the renderable area
         */
        Box.prototype.getDrawHeight = function () {
            return this.height;
        };
        /**
         * Set the alignment
         *
         * @param  align  alignment
         */
        Box.prototype.setAlign = function (align) {
            switch (align) {
                case 0 /* TopLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 1 /* TopCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 2 /* TopRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(0 /* Top */);
                    break;
                case 3 /* BottomRight */:
                    this.setHorizontalAlign(1 /* Right */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 4 /* BottomCenter */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 5 /* BottomLeft */:
                    this.setHorizontalAlign(0 /* Left */);
                    this.setVerticalAlign(1 /* Bottom */);
                    break;
                case 6 /* Center */:
                    this.setHorizontalAlign(2 /* Center */);
                    this.setVerticalAlign(2 /* Center */);
                    break;
            }
        };
        /**
         * Set the X pivot location relative to the image size
         *
         * @param  horizontal  alignment on X
         */
        Box.prototype.setHorizontalAlign = function (horizontal) {
            this.horzAlign = horizontal;
            switch (horizontal) {
                case 0 /* Left */:
                    {
                        this.transform.setPivotX(0);
                    }
                    break;
                case 1 /* Right */:
                    {
                        this.transform.setPivotX(this.getDrawWidth());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotX(Math.floor(this.getDrawWidth() / 2));
                    }
                    break;
            }
        };
        /**
         * Set the Y pivot location relative to the image size
         *
         * @param  vertical  alignment on Y
         */
        Box.prototype.setVerticalAlign = function (vertical) {
            this.vertAlign = vertical;
            switch (vertical) {
                case 0 /* Top */:
                    {
                        this.transform.setPivotY(0);
                    }
                    break;
                case 1 /* Bottom */:
                    {
                        this.transform.setPivotY(this.getDrawHeight());
                    }
                    break;
                case 2 /* Center */:
                    {
                        this.transform.setPivotY(Math.floor(this.getDrawHeight() / 2));
                    }
                    break;
            }
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Box.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(), this.getHeight());
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        Box.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(), this.getDrawHeight());
        };
        /**
         * Set whether rectangle is Fill or Stroke
         *
         * @param   isFilled    boolean for fill (true) or stroke (false)
         */
        Box.prototype.setIsFilled = function (isFilled) {
            this.isFilled = isFilled;
        };
        /**
         * Get whether rectangle is Fill or Stroke
         */
        Box.prototype.getIsFilled = function () {
            return this.isFilled;
        };
        /**
         * Set the line width of the box
         * @param   number  the width of the line
        */
        Box.prototype.setLineWidth = function (width) {
            this.lineWidth = width;
        };
        /*
         * Get the line width of the box
        */
        Box.prototype.getLineWidth = function () {
            return this.lineWidth;
        };
        /**
         * Set the color of the box
         *
         * @param  color  CSS color of the box
         */
        Box.prototype.setColor = function (color) {
            this.color = color;
        };
        /**
         * Get the CSS color of the box
         */
        Box.prototype.getColor = function () {
            return this.color;
        };
        /**
         * Set the opacity of the box
         *
         * @param  opacity  opacity of box 0..1
         */
        Box.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
        };
        /**
         * Get the opacity of the box
         */
        Box.prototype.getOpacity = function () {
            return this.opacity;
        };
        /**
         * Set the visibility of the box
         *
         * @param  visible  true if box is visible
         */
        Box.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility of the box..local
         */
        Box.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Check the visibility of the renderable
         */
        Box.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        /**
         * Get the z rendering order of the renderable
         */
        Box.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        Box.prototype.render = function (cr) {
            if (this.opacity == 0) {
                return;
            }
            var transScale = this.transform.getUseTranslationScale() ? this.transform.getTranslationScale() : 1;
            cr.drawRectangle(this.transform.getXfm(), this.width * transScale, this.height * transScale, this.color, this.opacity, this.lineWidth, this.isFilled);
        };
        /**
         * Get the actor who owns the component
         */
        Box.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        Box.prototype.getName = function () {
            return exports.Components.Box;
        };
        return Box;
    })();
    exports.Box = Box;
    /**
     * @file Matrix2d.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Affine transformation matrix
     */
    var Matrix2d = (function () {
        /**
         * Create a Matrix2d object
         */
        function Matrix2d() {
            this.m11 = 1;
            this.m12 = 0;
            this.m21 = 0;
            this.m22 = 1;
            this.tx = 0;
            this.ty = 0;
        }
        /**
         * Set the transform manually
         *
         * @param  m11  11 component (a component on Canvas spec)
         * @param  m12  12 component (b component on Canvas spec)
         * @param  m21  21 component (c component on Canvas spec)
         * @param  m22  22 component (d component on Canvas spec)
         * @param  tx  translate x component
         * @param  ty  translate y component
         */
        Matrix2d.prototype.set = function (m11, m12, m21, m22, tx, ty) {
            this.m11 = m11;
            this.m12 = m12;
            this.m21 = m21;
            this.m22 = m22;
            this.tx = tx;
            this.ty = ty;
            return this;
        };
        /**
         * Set the transform from another matrix
         *
         * @param  mtx  matrix to get values from
         */
        Matrix2d.prototype.setFrom = function (mtx) {
            this.m11 = mtx.m11;
            this.m12 = mtx.m12;
            this.m21 = mtx.m21;
            this.m22 = mtx.m22;
            this.tx = mtx.tx;
            this.ty = mtx.ty;
            return this;
        };
        /**
         * Concatenates the specified matrix properties with this matrix.
         *
         * @param  m11  11 component (a component on Canvas spec)
         * @param  m12  12 component (b component on Canvas spec)
         * @param  m21  21 component (c component on Canvas spec)
         * @param  m22  22 component (d component on Canvas spec)
         * @param  tx  translate x component
         * @param  ty  translate y component
         */
        Matrix2d.prototype.prepend = function (m11, m12, m21, m22, tx, ty) {
            var tx1 = this.tx;
            if (m11 != 1 || m21 != 0 || m21 != 0 || m22 != 1) {
                var a1 = this.m11;
                var c1 = this.m21;
                this.m11 = a1 * m11 + this.m12 * m21;
                this.m12 = a1 * m12 + this.m12 * m22;
                this.m21 = c1 * m11 + this.m22 * m21;
                this.m22 = c1 * m12 + this.m22 * m22;
            }
            this.tx = tx1 * m11 + this.ty * m21 + tx;
            this.ty = tx1 * m12 + this.ty * m22 + ty;
            return this;
        };
        /**
         * Appends the specified matrix properties with this matrix.
         *
         * @param  m11  11 component (a component on Canvas spec)
         * @param  m12  12 component (b component on Canvas spec)
         * @param  m21  21 component (c component on Canvas spec)
         * @param  m22  22 component (d component on Canvas spec)
         * @param  tx  translate x component
         * @param  ty  translate y component
         */
        Matrix2d.prototype.append = function (m11, m12, m21, m22, tx, ty) {
            var a1 = this.m11;
            var b1 = this.m12;
            var c1 = this.m21;
            var d1 = this.m22;
            this.m11 = m11 * a1 + m12 * c1;
            this.m12 = m11 * b1 + m12 * d1;
            this.m21 = m21 * a1 + m22 * c1;
            this.m22 = m21 * b1 + m22 * d1;
            this.tx = tx * a1 + ty * c1 + this.tx;
            this.ty = tx * b1 + ty * d1 + this.ty;
            return this;
        };
        /**
         * Prepends the specified matrix with this matrix.
         *
         * @param  mtx  matrix to prepend
         */
        Matrix2d.prototype.prependMatrix = function (mtx) {
            this.prepend(mtx.m11, mtx.m12, mtx.m21, mtx.m22, mtx.tx, mtx.ty);
            return this;
        };
        /**
         * Appends the specified matrix with this matrix.
         *
         * @param  mtx  matrix to append
         */
        Matrix2d.prototype.appendMatrix = function (mtx) {
            this.append(mtx.m11, mtx.m12, mtx.m21, mtx.m22, mtx.tx, mtx.ty);
            return this;
        };
        /**
         * Prepend to the matrix using transform properties
         *
         * @param  x  x translation
         * @param  y  y translation
         * @param  scaleX  x scale
         * @param  scaleY  y scale
         * @param  rotation  matrix rotation in degrees
         * @param  skewX  skew on the x
         * @param  skewY  skew on the y
         * @param  pivotX  pivot on the x
         * @param  pivotY  pivot on the y
         */
        Matrix2d.prototype.prependTransform = function (x, y, scaleX, scaleY, rotation, skewX, skewY, pivotX, pivotY) {
            var cos = 1, sin = 0;
            if ((rotation % 360) != 0) {
                var r = (new MathUtil()).toRadians(rotation);
                cos = Math.cos(r);
                sin = Math.sin(r);
            }
            if (pivotX != 0 || pivotY != 0) {
                this.tx -= pivotX;
                this.ty -= pivotY;
            }
            if (skewX != 0 || skewY != 0) {
                // TODO: can this be combined into a single prepend operation?
                skewX *= MathUtil.PI180;
                skewY *= MathUtil.PI180;
                this.prepend(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, 0, 0);
                this.prepend(Math.cos(skewY), Math.sin(skewY), -Math.sin(skewX), Math.cos(skewX), x, y);
            }
            else {
                this.prepend(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, x, y);
            }
            return this;
        };
        /**
         * Append to the matrix using transform properties
         *
         * @param  x  x translation
         * @param  y  y translation
         * @param  scaleX  x scale
         * @param  scaleY  y scale
         * @param  rotation  matrix rotation in degrees
         * @param  skewX  skew on the x
         * @param  skewY  skew on the y
         * @param  pivotX  pivot on the x
         * @param  pivotY  pivot on the y
         */
        Matrix2d.prototype.appendTransform = function (x, y, scaleX, scaleY, rotation, skewX, skewY, pivotX, pivotY) {
            var cos = 1, sin = 0;
            if ((rotation % 360) != 0) {
                var r = (new MathUtil()).toRadians(rotation);
                cos = Math.cos(r);
                sin = Math.sin(r);
            }
            if (skewX != 0 || skewY != 0) {
                // TODO: can this be combined into a single append?
                skewX *= MathUtil.PI180;
                skewY *= MathUtil.PI180;
                this.append(Math.cos(skewY), Math.sin(skewY), -Math.sin(skewX), Math.cos(skewX), x, y);
                this.append(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, 0, 0);
            }
            else {
                this.append(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, x, y);
            }
            if (pivotX != 0 || pivotY != 0) {
                this.tx -= pivotX * this.m11 + pivotY * this.m21;
                this.ty -= pivotX * this.m12 + pivotY * this.m22;
            }
            return this;
        };
        /**
         * Applies a rotation transformation to the matrix.
         *
         * @param  angle  angle in degrees
         */
        Matrix2d.prototype.rotate = function (angle) {
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var a1 = this.m11;
            var c1 = this.m21;
            var tx1 = this.tx;
            this.m11 = a1 * cos - this.m12 * sin;
            this.m12 = a1 * sin + this.m12 * cos;
            this.m21 = c1 * cos - this.m22 * sin;
            this.m22 = c1 * sin + this.m22 * cos;
            this.tx = tx1 * cos - this.ty * sin;
            this.ty = tx1 * sin + this.ty * cos;
            return this;
        };
        /**
         * Applies a skew transformation to the matrix.
         *
         * @param  skewX  The amount to skew horizontally in degrees.
         * @param  skewY  The amount to skew vertically in degrees.
         */
        Matrix2d.prototype.skew = function (skewX, skewY) {
            skewX = skewX * MathUtil.PI180;
            skewY = skewY * MathUtil.PI180;
            this.append(Math.cos(skewY), Math.sin(skewY), -Math.sin(skewX), Math.cos(skewX), 0, 0);
            return this;
        };
        /**
         * Applies a scale transformation to the matrix.
         *
         * @param  x  amount to scale on x axis
         * @param  y  amount to scale on y axis
         */
        Matrix2d.prototype.scale = function (x, y) {
            this.m11 *= x;
            this.m22 *= y;
            this.tx *= x;
            this.ty *= y;
            return this;
        };
        /**
         * Translates the matrix on the x and y axes.
         *
         * @param  x  amount on x axis
         * @param  y  amount on y axis
         */
        Matrix2d.prototype.translate = function (x, y) {
            this.tx += x;
            this.ty += y;
            return this;
        };
        /**
         * Inverts the matrix.
         */
        Matrix2d.prototype.invert = function () {
            var a1 = this.m11;
            var b1 = this.m12;
            var c1 = this.m21;
            var d1 = this.m22;
            var tx1 = this.tx;
            var n = a1 * d1 - b1 * c1;
            this.m11 = d1 / n;
            this.m12 = -b1 / n;
            this.m21 = -c1 / n;
            this.m22 = a1 / n;
            this.tx = (c1 * this.ty - d1 * tx1) / n;
            this.ty = -(a1 * this.ty - b1 * tx1) / n;
            return this;
        };
        /**
         * Set the matrix back to the identity
         */
        Matrix2d.prototype.identity = function () {
            this.m11 = 1.0;
            this.m12 = 0.0;
            this.m21 = 0.0;
            this.m22 = 1.0;
            this.tx = 0.0;
            this.ty = 0.0;
            return this;
        };
        /**
         * Clone the matrix and return a new matrix
         */
        Matrix2d.prototype.clone = function () {
            var mtx = new Matrix2d();
            mtx.set(this.m11, this.m12, this.m21, this.m22, this.tx, this.ty);
            return mtx;
        };
        /**
         * Returns whether the matrix is the identity
         */
        Matrix2d.prototype.isIdentity = function () {
            return ((this.m11 == 1) && (this.m12 == 0) && (this.m21 == 0) && (this.m22 == 1) && (this.tx == 0) && (this.ty == 0));
        };
        /**
         * Matrix equality
         *
         * @param {Matrix2d} mtx - RHS
         */
        Matrix2d.prototype.equals = function (mtx) {
            return ((this.m11 == mtx.m11) && (this.m12 == mtx.m12) && (this.m21 == mtx.m21) && (this.m22 == mtx.m22) && (this.tx == mtx.tx) && (this.ty == mtx.ty));
        };
        /**
         * Return string representation of matrix
         */
        Matrix2d.prototype.toString = function () {
            return "Matrix2d (m11=" + this.m11 + " m12=" + this.m12 + " m21=" + this.m21 + " m22=" + this.m22 + " tx=" + this.tx + " ty=" + this.ty + ")";
        };
        return Matrix2d;
    })();
    exports.Matrix2d = Matrix2d;
    /**
     * Text effect to render a solid fill of text
     */
    var SolidFillEffect = (function () {
        /**
         * Create a SolidFillEffect object
         *
         * @param  color  the color of the fill
         */
        function SolidFillEffect(color) {
            this.color = color;
        }
        /**
         * Called to render text on a canvas using the effect
         *
         * @param  canvas  cavnas to use for rendering
         * @param  text  text to draw
         * @param  drawPosX  x position to draw text at
         * @param  drawPosY  y position to draw text at
         * @param  textWidth  width of the text to render
         * @param  textHeight  height of the text to render
         * @param  maxWidth  maximum width of a line of text
         * @param  multiLine  true if this is part of multiline text
         */
        SolidFillEffect.prototype.render = function (canvas, text, drawPosX, drawPosY, textWidth, textHeight, maxWidth, multiLine) {
            canvas.setFillStyle(this.color);
            canvas.drawFillText(text, drawPosX, drawPosY, maxWidth);
        };
        /**
         * Called to get any extended text width that is needed to render the effect
         */
        SolidFillEffect.prototype.getExtendedTextWidth = function () {
            return 0;
        };
        /**
         * Called to get any extended text height that is needed to render the effect
         */
        SolidFillEffect.prototype.getExtendedTextHeight = function () {
            return 0;
        };
        return SolidFillEffect;
    })();
    exports.SolidFillEffect = SolidFillEffect;
    /**
     * Text effect to render a solid stroke of text
     */
    var SolidStrokeEffect = (function () {
        /**
         * Create a SolidStrokeEffect object
         *
         * @param  color  the color of the stroke
         * @param  lineWidth  the line width of the stroke
         */
        function SolidStrokeEffect(color, lineWidth) {
            this.color = color;
            this.lineWidth = lineWidth;
        }
        /**
         * Called to render text on a canvas using the effect
         *
         * @param  canvas  cavnas to use for rendering
         * @param  text  text to draw
         * @param  drawPosX  x position to draw text at
         * @param  drawPosY  y position to draw text at
         * @param  textWidth  width of the text to render
         * @param  textHeight  height of the text to render
         * @param  maxWidth  maximum width of a line of text
         * @param  multiLine  true if this is part of multiline text
         */
        SolidStrokeEffect.prototype.render = function (canvas, text, drawPosX, drawPosY, textWidth, textHeight, maxWidth, multiLine) {
            canvas.setLineWidth(this.lineWidth);
            canvas.setStrokeStyle(this.color);
            canvas.drawText(text, drawPosX, drawPosY, maxWidth);
        };
        /**
         * Called to get any extended text width that is needed to render the effect
         */
        SolidStrokeEffect.prototype.getExtendedTextWidth = function () {
            return 0;
        };
        /**
         * Called to get any extended text height that is needed to render the effect
         */
        SolidStrokeEffect.prototype.getExtendedTextHeight = function () {
            return 0;
        };
        return SolidStrokeEffect;
    })();
    exports.SolidStrokeEffect = SolidStrokeEffect;
    /**
     * Text effect to render a solid fill text with a shadow
     */
    var ShadowTextEffect = (function () {
        /**
         * Create a ShadowTextEffect object
         *
         * @param  color  the color of the fill
         * @param  shadowOffsetX  shadow offset on the x
         * @param  shadowOffsetY  shadow offset on the y
         * @param  shadowColor  shadow color CSS value
         * @param  shadowBlur  shadow blur factor
         */
        function ShadowTextEffect(color, shadowOffsetX, shadowOffsetY, shadowColor, shadowBlur) {
            this.color = color;
            this.shadowOffsetX = shadowOffsetX;
            this.shadowOffsetY = shadowOffsetY;
            this.shadowColor = shadowColor;
            this.shadowBlur = shadowBlur;
        }
        /**
         * Called to render text on a canvas using the effect
         *
         * @param  canvas  cavnas to use for rendering
         * @param  text  text to draw
         * @param  drawPosX  x position to draw text at
         * @param  drawPosY  y position to draw text at
         * @param  textWidth  width of the text to render
         * @param  textHeight  height of the text to render
         * @param  maxWidth  maximum width of a line of text
         * @param  multiLine  true if this is part of multiline text
         */
        ShadowTextEffect.prototype.render = function (canvas, text, drawPosX, drawPosY, textWidth, textHeight, maxWidth, multiLine) {
            canvas.setFillStyle(this.color);
            canvas.setTextShadowProperties(this.shadowOffsetX, this.shadowOffsetY, this.shadowColor, this.shadowBlur);
            canvas.drawFillText(text, drawPosX, drawPosY, maxWidth);
            canvas.setTextShadowProperties(0, 0, "rgb(0,0,0)", 0);
        };
        /**
         * Called to get any extended text width that is needed to render the effect
         */
        ShadowTextEffect.prototype.getExtendedTextWidth = function () {
            return this.shadowOffsetX + this.shadowBlur;
        };
        /**
         * Called to get any extended text height that is needed to render the effect
         */
        ShadowTextEffect.prototype.getExtendedTextHeight = function () {
            return this.shadowOffsetY + this.shadowBlur;
        };
        return ShadowTextEffect;
    })();
    exports.ShadowTextEffect = ShadowTextEffect;
    /**
     * Text effect to render a gradient fill of text
     */
    var GradientFillEffect = (function () {
        /**
         * Create a GradientFillEffect object
         *
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1]
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size [0..1]
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size [0..1]
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size [0..1]
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size [0..1]
         */
        function GradientFillEffect(colors, ratios, x0, y0, x1, y1) {
            this.colors = colors;
            this.ratios = ratios;
            this.positions = [x0, y0, x1, y1];
        }
        /**
         * Called to render text on a canvas using the effect
         *
         * @param  canvas  cavnas to use for rendering
         * @param  text  text to draw
         * @param  drawPosX  x position to draw text at
         * @param  drawPosY  y position to draw text at
         * @param  textWidth  width of the text to render
         * @param  textHeight  height of the text to render
         * @param  maxWidth  maximum width of a line of text
         * @param  multiLine  true if this is part of multiline text
         */
        GradientFillEffect.prototype.render = function (canvas, text, drawPosX, drawPosY, textWidth, textHeight, maxWidth, multiLine) {
            if (this.gradient == undefined || multiLine) {
                var pos = [0, 0, 0, 0];
                pos[0] = this.positions[0] * textWidth;
                pos[1] = this.positions[1];
                pos[2] = textWidth;
                pos[3] = textHeight;
                this.gradient = canvas.createLinearGradient(pos);
                for (var i = 0; i < this.colors.length; ++i) {
                    this.gradient.addColorStop(this.ratios[i], this.colors[i]);
                }
            }
            canvas.setGradientFillStyle(this.gradient);
            canvas.drawFillText(text, drawPosX, drawPosY, maxWidth);
        };
        /**
         * Called to get any extended text width that is needed to render the effect
         */
        GradientFillEffect.prototype.getExtendedTextWidth = function () {
            return 0;
        };
        /**
         * Called to get any extended text height that is needed to render the effect
         */
        GradientFillEffect.prototype.getExtendedTextHeight = function () {
            return 0;
        };
        return GradientFillEffect;
    })();
    exports.GradientFillEffect = GradientFillEffect;
    /**
     * Text effect to render a gradient stroke of text
     */
    var GradientStrokeEffect = (function () {
        /**
         * Create a GradientStrokeEffect object
         *
         * @param  lineWidth  the line width of the stroke
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1]
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size [0..1]
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size [0..1]
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size [0..1]
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size [0..1]
         */
        function GradientStrokeEffect(lineWidth, colors, ratios, x0, y0, x1, y1) {
            this.lineWidth = lineWidth;
            this.colors = colors;
            this.ratios = ratios;
            this.positions = [x0, y0, x1, y1];
        }
        /**
         * Called to render text on a canvas using the effect
         *
         * @param  canvas  cavnas to use for rendering
         * @param  text  text to draw
         * @param  drawPosX  x position to draw text at
         * @param  drawPosY  y position to draw text at
         * @param  textWidth  width of the text to render
         * @param  textHeight  height of the text to render
         * @param  maxWidth  maximum width of a line of text
         * @param  multiLine  true if this is part of multiline text
         */
        GradientStrokeEffect.prototype.render = function (canvas, text, drawPosX, drawPosY, textWidth, textHeight, maxWidth, multiLine) {
            if (this.gradient == undefined || multiLine) {
                var pos = [0, 0, 0, 0];
                pos[0] = this.positions[0] * textWidth;
                pos[1] = this.positions[1];
                pos[2] = this.positions[2] * textWidth;
                pos[3] = this.positions[3] * textHeight;
                this.gradient = canvas.createLinearGradient(pos);
                for (var i = 0; i < this.colors.length; ++i) {
                    this.gradient.addColorStop(this.ratios[i], this.colors[i]);
                }
            }
            canvas.setLineWidth(this.lineWidth);
            canvas.setGradientStrokeStyle(this.gradient);
            canvas.drawText(text, drawPosX, drawPosY, maxWidth);
        };
        /**
         * Called to get any extended text width that is needed to render the effect
         */
        GradientStrokeEffect.prototype.getExtendedTextWidth = function () {
            return 0;
        };
        /**
         * Called to get any extended text height that is needed to render the effect
         */
        GradientStrokeEffect.prototype.getExtendedTextHeight = function () {
            return 0;
        };
        return GradientStrokeEffect;
    })();
    exports.GradientStrokeEffect = GradientStrokeEffect;
    /**
     * @file VectorGraphics.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Singular vector graphics instruction
     */
    var VGInstruction = (function () {
        /**
         * Create a VGInstruction object
         *
         * @param  func  function to run for instruction
         * @param  params  set of parameters to send to function
         */
        function VGInstruction(func, params) {
            this.func = func;
            this.params = params;
        }
        /**
         * Called to run the function with the parameters specified in the context
         *
         * @param  ctx  context to run the function in
         */
        VGInstruction.prototype.run = function (ctx) {
            this.func.apply(ctx, this.params);
        };
        return VGInstruction;
    })();
    exports.VGInstruction = VGInstruction;
    /**
     * Collection of instructions that make up a session of drawing
     */
    var VGInstructionSession = (function () {
        function VGInstructionSession() {
        }
        VGInstructionSession.prototype.destroy = function () {
            this.instructions = null;
            this.fillInstructions = null;
            this.strokeStyleInstructions = null;
            this.strokeInstructions = null;
        };
        return VGInstructionSession;
    })();
    exports.VGInstructionSession = VGInstructionSession;
    /**
     * Component to handle rendering 2d vector graphics
     */
    var VectorGraphics = (function () {
        /**
         * Create a new VectorGraphics object
         *
         * @param  actor  actor that owns the component
         * @param  Transform  Transform component needed during runtime
         * @param  canvas  canvas to use for rendering
         */
        function VectorGraphics(actor, transform, canvas) {
            this.actor = actor;
            this.transform = transform;
            this.visible = true;
            this.opacity = 1;
            this.canvas = canvas;
            this.context = canvas.getContext('2d');
            this.beginIns = new VGInstruction(this.context.beginPath, []);
            this.strokeIns = new VGInstruction(this.context.stroke, []);
            this.fillIns = new VGInstruction(this.context.fill, []);
            this.prevInstructions = null;
            this.instructions = null;
            this.activeInstructions = null;
            this.clear();
            actor.addComponent(this.getName(), this);
            actor.addComponent(exports.Components.Renderable, this);
        }
        /**
         * Clear active instructions.
         */
        VectorGraphics.prototype.clear = function () {
            this.prevInstructions = new Array();
            this.instructions = new Array();
            this.activeInstructions = new VGInstructionSession();
            this.activeInstructions.instructions = new Array();
            this.activeInstructions.fillInstructions = null;
            this.activeInstructions.strokeStyleInstructions = null;
            this.activeInstructions.strokeInstructions = null;
            this.dirty = true;
            this.active = false;
        };
        /**
         * Set the visibility
         *
         * @param  visible  the visibility
         */
        VectorGraphics.prototype.setVisible = function (visible) {
            this.visible = visible;
        };
        /**
         * Get the visibility
         */
        VectorGraphics.prototype.getVisible = function () {
            return this.visible;
        };
        /**
         * Set the opacity
         *
         * @param  opacity  the opacity..[0..1]
         */
        VectorGraphics.prototype.setOpacity = function (opacity) {
            this.opacity = opacity;
        };
        /**
         * Get the opacity
         */
        VectorGraphics.prototype.getOpacity = function () {
            return this.opacity;
        };
        /**
         * Moves the drawing point to the specified position
         *
         * @param  x  x coordinate to move to
         * @param  y  y coordinate to move to
         */
        VectorGraphics.prototype.moveTo = function (x, y) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.moveTo, [x, y]));
            return this;
        };
        /**
         * Draws a line from the current drawing point to the specified position, which then
         * becomes the new current drawing point.
         *
         * @param  x  x coordinate to draw to
         * @param  y  y coordinate to draw to
         */
        VectorGraphics.prototype.lineTo = function (x, y) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x, y]));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draws an arc from the current draw point with the specified control points and radius.
         *
         * @param  x1  x coordinate of first control point
         * @param  y1  y coordinate of first control point
         * @param  x2  x coordinate of second control point
         * @param  y2  y coordinate of second control point
         * @param  radius  arc radius
         */
        VectorGraphics.prototype.arcTo = function (x1, y1, x2, y2, radius) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arcTo, [x1, y1, x2, y2, radius]));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draws an arc defined by the radius, startAngle, and endAngle arguments, centered at the
         * position (x,y). For example  arc(100, 100, 20, 0, Math.PI*2) would draw a full circle
         * with a radius of 20 centered at (100, 100)
         *
         * @param  x  x coordinate for center
         * @param  y  y coordinate for center
         * @param  radius  radius of arc
         * @param  startAngle  angle at start in radians
         * @param  endAngle  angle at end in radians
         * @param  antiClockwise  true if winding order is anti-clockwise
         */
        VectorGraphics.prototype.arc = function (x, y, radius, startAngle, endAngle, antiClockwise) {
            if (antiClockwise === void 0) { antiClockwise = false; }
            var params = [x, y, radius, startAngle, endAngle, antiClockwise];
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arc, params));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draws a quadratic curve from the current drawing point (x,y) using the control
         * point (cpx, cpy).
         *
         * @param  cpx  x coordinate of control point
         * @param  cpy  y coordinate of control point
         * @param  x  x coordinate of draw to point
         * @param  y  y coordinate of draw to point
         */
        VectorGraphics.prototype.quadraticCurveTo = function (cpx, cpy, x, y) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.quadraticCurveTo, [cpx, cpy, x, y]));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draws a bezier curve from the current drawing point to (x,y) using the control
         * points (cp1x, cp1y) and (cp2x, cp2y).
         *
         * @param  cp1x  x coordinate of first control point
         * @param  cp1y  y coordinate of first control point
         * @param  cp2x  x coordinate of second control point
         * @param  cp2y  y coordinate of second control point
         * @param  x  x coordinate of draw to point
         * @param  y  y coordinate of draw to point
         */
        VectorGraphics.prototype.bezierCurveTo = function (cp1x, cp1y, cp2x, cp2y, x, y) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.bezierCurveTo, [cp1x, cp1y, cp2x, cp2y, x, y]));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draw a rectangle at (x,y) with the specified width and height use the current fill
         * and/or stroke.
         *
         * @param  x  x coordinate to draw rect at
         * @param  y  y coordinate to draw rect at
         * @param  w  width of rectangle
         * @param  h  height of rectangle
         */
        VectorGraphics.prototype.rect = function (x, y, w, h) {
            this.activeInstructions.instructions.push(new VGInstruction(this.context.rect, [x, y, w, h]));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Closes the current path, effectively drawing a line from the current drawing point to
         * the first drawing point specified since the fill or stroke was last set.
         */
        VectorGraphics.prototype.closePath = function () {
            if (this.active) {
                this.activeInstructions.instructions.push(new VGInstruction(this.context.closePath, []));
                this.dirty = true;
            }
            return this;
        };
        /**
         * Begins a fill with the specified color.
         *
         * @param    color    CSS compatible color string
         */
        VectorGraphics.prototype.beginFill = function (color) {
            if (this.active) {
                this.newPath();
            }
            this.activeInstructions.fillInstructions = (color != undefined) ? [new VGInstruction(this.setProperty, ["fillStyle", color])] : null;
            return this;
        };
        /**
         * Begins a linear gradient fill defined by the line (x0, y0) to (x1, y1). This ends the
         * current subpath.
         *
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1].
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size
         */
        VectorGraphics.prototype.beginLinearGradientFill = function (colors, ratios, x0, y0, x1, y1) {
            if (this.active) {
                this.newPath();
            }
            var cg = this.context.createLinearGradient(x0, y0, x1, y1);
            for (var i = 0; i < colors.length; ++i) {
                cg.addColorStop(ratios[i], colors[i]);
            }
            this.activeInstructions.fillInstructions = [new VGInstruction(this.setProperty, ["fillStyle", cg])];
            return this;
        };
        /**
         * Begins a radial gradient fill. This ends the current subpath.
         *
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1]
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  r0  radius of the inner circle that defines the gradient
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  r1  radius of the outer circle that defines the gradient
         */
        VectorGraphics.prototype.beginRadialGradientFill = function (colors, ratios, x0, y0, r0, x1, y1, r1) {
            if (this.active) {
                this.newPath();
            }
            var cg = this.context.createRadialGradient(x0, y0, r0, x1, y1, r1);
            for (var i = 0; i < colors.length; ++i) {
                cg.addColorStop(ratios[i], colors[i]);
            }
            this.activeInstructions.fillInstructions = [new VGInstruction(this.setProperty, ["fillStyle", cg])];
            return this;
        };
        /**
         * Ends the current subpath, and begins a new one with no fill.
         */
        VectorGraphics.prototype.endFill = function () {
            return this.beginFill();
        };
        /**
         * Set the stroke style for the current subpath.
         *
         * @param  thickness  the width of the stroke
         * @param  caps  indicates the type of caps to use at the end if lines.
         *               (optional) [ "butt", "round", "square" ]
         * @param  joints  specifies the type of joints that should be used where two lines meet.
         *                 (optional) [ "bevel", "round", "miter" ]
         * @param  miterLimit  if joints is set to "miter", then you can specify a miter limit
         *                     ratio which controls at what point a mitered joint will be clipped.
         */
        VectorGraphics.prototype.setStrokeStyle = function (thickness, caps, joints, miterLimit) {
            if (caps === void 0) { caps = "butt"; }
            if (joints === void 0) { joints = "miter"; }
            if (miterLimit === void 0) { miterLimit = 10; }
            if (this.active) {
                this.newPath();
            }
            this.activeInstructions.strokeStyleInstructions = [
                new VGInstruction(this.setProperty, ["lineWidth", thickness]),
                new VGInstruction(this.setProperty, ["lineCap", caps]),
                new VGInstruction(this.setProperty, ["lineJoin", joints]),
                new VGInstruction(this.setProperty, ["miterLimit", miterLimit])
            ];
            return this;
        };
        /**
         * Begins a stroke with the specified color.
         *
         * @param  color  CSS compatible color string
         * @param  width  stroke width in pixels
         */
        VectorGraphics.prototype.beginStroke = function (color, width) {
            if (width === void 0) { width = 1; }
            if (this.active) {
                this.newPath();
            }
            this.activeInstructions.strokeInstructions = null;
            if (color != undefined) {
                this.activeInstructions.strokeInstructions = [new VGInstruction(this.setProperty, ["strokeStyle", color]), new VGInstruction(this.setProperty, ["lineWidth", width])];
            }
            return this;
        };
        /**
         * Begins a linear gradient stroke defined by the line (x0, y0) to (x1, y1). This ends the
         * current subpath.
         *
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1]
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size
         */
        VectorGraphics.prototype.beginLinearGradientStroke = function (colors, ratios, x0, y0, x1, y1) {
            if (this.active) {
                this.newPath();
            }
            var cg = this.context.createLinearGradient(x0, y0, x1, y1);
            for (var i = 0; i < colors.length; ++i) {
                cg.addColorStop(ratios[i], colors[i]);
            }
            this.activeInstructions.strokeInstructions = [new VGInstruction(this.setProperty, ["strokeStyle", cg])];
            return this;
        };
        /**
         * Begins a radial gradient stroke. This ends the current subpath.
         *
         * @param  colors  array of CSS compatible color strings
         * @param  ratios  array of gradient positions which correspond to the colors. Positions
         *                 are [0..1]
         * @param  x0  x position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  y0  y position of the first point defining the line that defines the gradient
         *             direction and size
         * @param  r0  radius of the inner circle that defines the gradient
         * @param  x1  x position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  y1  y position of the second point defineing the line that defines the gradient
         *             direction and size
         * @param  r1  radius of the outer circle that defines the gradient
         */
        VectorGraphics.prototype.beginRadialGradientStroke = function (colors, ratios, x0, y0, r0, x1, y1, r1) {
            if (this.active) {
                this.newPath();
            }
            var cg = this.context.createRadialGradient(x0, y0, r0, x1, y1, r1);
            for (var i = 0; i < colors.length; ++i) {
                cg.addColorStop(ratios[i], colors[i]);
            }
            this.activeInstructions.strokeInstructions = [new VGInstruction(this.setProperty, ["strokeStyle", cg])];
            return this;
        };
        /**
         * Ends the current subpath, and begins a new one with no stroke.
         */
        VectorGraphics.prototype.endStroke = function () {
            return this.beginStroke();
        };
        /**
         * Drawa a rounded rectangle with all corners with the same radius.
         *
         * @param  x  x coordinate for draw point
         * @param  y  y coordinate for draw point
         * @param  w  width of rectangle
         * @param  h  height of reectangle
         * @param  r  radius of corners
         */
        VectorGraphics.prototype.roundRect = function (x, y, w, h, r) {
            return this.roundRectComplex(x, y, w, h, r, r, r, r);
        };
        /**
         * Draws a rounded rectangle with different corner radii. Supports positive and negative
         * corner radii.
         *
         * @param  x  x coordinate for draw point
         * @param  y  y coordinate for draw point
         * @param  w  width of rectangle
         * @param  h  height of reectangle
         * @param  rTL  radius of top left corner
         * @param  rTR  radius of top right corner
         * @param  rBR  radius of bottom right corner
         * @param  rBL  radisu of bottom left corner
         */
        VectorGraphics.prototype.roundRectComplex = function (x, y, w, h, rTL, rTR, rBR, rBL) {
            var max = ((w < h) ? w : h) / 2;
            var mTL = 0, mTR = 0, mBR = 0, mBL = 0;
            if (rTL < 0) {
                rTL *= (mTL = -1);
            }
            if (rTL > max) {
                rTL = max;
            }
            if (rTR < 0) {
                rTR *= (mTR = -1);
            }
            if (rTR > max) {
                rTR = max;
            }
            if (rBR < 0) {
                rBR *= (mBR = -1);
            }
            if (rBR > max) {
                rBR = max;
            }
            if (rBL < 0) {
                rBL *= (mBL = -1);
            }
            if (rBL > max) {
                rBL = max;
            }
            this.activeInstructions.instructions.push(new VGInstruction(this.context.moveTo, [x + w - rTR, y]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arcTo, [x + w + rTR * mTR, y - rTR * mTR, x + w, y + rTR, rTR]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x + w, y + h - rBR]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arcTo, [x + w + rBR * mBR, y + h + rBR * mBR, x + w - rBR, y + h, rBR]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x + rBL, y + h]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arcTo, [x - rBL * mBL, y + h + rBL * mBL, x, y + h - rBL, rBL]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x, y + rTL]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.arcTo, [x - rTL * mTL, y - rTL * mTL, x + rTL, y, rTL]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.closePath, []));
            this.dirty = this.active = true;
            return this;
        };
        /**
         * Draws a circle with the spcified radius at (x,y)
         *
         * @param  x  x coordinate of center of circle
         * @param  y  y coordinate of center of circle
         * @param  r  radius of circle
         */
        VectorGraphics.prototype.circle = function (x, y, r) {
            return this.arc(x, y, r, 0, Math.PI * 2.0);
        };
        /**
         * Draws an ellipse.
         *
         * @param  x  x coordinate of center of ellipse
         * @param  y  y coordinate of center of ellipse
         * @param  w  width of ellipse
         * @param  h  height of ellipse
         * @param  startAngle  angle at start in radians
         * @param  endAngle  angle at end in radians
         * @param  innerRadius  radius of inner ellipse
         */
        VectorGraphics.prototype.ellipse = function (x, y, w, h, startAngle, endAngle, innerRadius) {
            var k = 0.5522848;
            var ox = (w / 2) * k;
            var oy = (h / 2) * k;
            var xe = x + w;
            var ye = y + h;
            var xm = x + w / 2;
            var ym = y + h / 2;
            this.activeInstructions.instructions.push(new VGInstruction(this.context.moveTo, [x, ym]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.bezierCurveTo, [x, ym - oy, xm - ox, y, xm, y]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.bezierCurveTo, [xm + ox, y, xe, ym - oy, xe, ym]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.bezierCurveTo, [xe, ym + oy, xm + ox, ye, xm, ye]));
            this.activeInstructions.instructions.push(new VGInstruction(this.context.bezierCurveTo, [xm - ox, ye, x, ym + oy, x, ym]));
            this.active = this.dirty = true;
            return this;
        };
        /**
         * Draws a star if pointSize is greater than 0 or a regular polygon if pointSize is 0 with
         * the specified number of points.
         *
         * @param  x  x position of the center of the shape
         * @param  y  y position of the center of the shape
         * @param  r  outer radius of the shape
         * @param  sides  number of points on the star or sides on the polygon
         * @param  pointSize  depth or "pointy-ness" of the star points. A pointsize of 0 will draw
         *                    a regular polygon ( no points ), a pointsize of 1 will draw nothing
         *                    because the points are infinitely pointy.
         * @param  angle  angle of the first point/corner. ie..a value of 0 will draw the first
         *                point to the right of the center.
         */
        VectorGraphics.prototype.polyStar = function (x, y, r, sides, pointSize, angle) {
            if (pointSize === void 0) { pointSize = 0; }
            if (angle === void 0) { angle = 0; }
            angle /= 180 / Math.PI;
            var a = Math.PI / sides;
            this.activeInstructions.instructions.push(new VGInstruction(this.context.moveTo, [x + Math.cos(angle) * r, y + Math.sin(angle) * r]));
            for (var i = 0; i < sides; ++i) {
                angle += a;
                if (pointSize != 1) {
                    this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x + Math.cos(angle) * r * pointSize, y + Math.sin(angle) * r * pointSize]));
                }
                angle += a;
                this.activeInstructions.instructions.push(new VGInstruction(this.context.lineTo, [x + Math.cos(angle) * r, y + Math.sin(angle) * r]));
            }
            this.active = this.dirty = true;
            return this;
        };
        /**
         * Check the visibility of the renderable
         */
        VectorGraphics.prototype.isVisible = function () {
            return (this.visible && this.transform.isVisible());
        };
        /**
         * Get the z rendering order of the renderable
         */
        VectorGraphics.prototype.getZOrder = function () {
            return this.transform.getWorldZOrder();
        };
        /**
         * Get the width of the renderable area
         */
        VectorGraphics.prototype.getWidth = function () {
            return this.canvas.width;
        };
        /**
         * Get the height of the renderable area
         */
        VectorGraphics.prototype.getHeight = function () {
            return this.canvas.height;
        };
        /**
         * Get the rendering width of the renderable area
         */
        VectorGraphics.prototype.getDrawWidth = function () {
            return this.canvas.width;
        };
        /**
         * Get the rendering height of the renderable area
         */
        VectorGraphics.prototype.getDrawHeight = function () {
            return this.canvas.height;
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        VectorGraphics.prototype.getBounds = function (bounds) {
            bounds.set(this.transform.getPositionX(), this.transform.getPositionY(), this.getWidth(), this.getHeight());
        };
        /**
         * Get the bounds of renderable
         *
         * @param  bounds  rect to set bounds to
         */
        VectorGraphics.prototype.getDrawBounds = function (bounds) {
            bounds.set(this.transform.getTranslatedPositionX(), this.transform.getTranslatedPositionY(), this.getDrawWidth(), this.getDrawHeight());
        };
        /**
         * Called to render the renderable to the specified canvas
         *
         * @param  cr  canvas renderer to use
         */
        VectorGraphics.prototype.render = function (cr) {
            if (this.dirty) {
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                if (this.active) {
                    this.prepare();
                }
                for (var i = 0; i < this.instructions.length; ++i) {
                    this.instructions[i].run(this.context);
                }
                this.dirty = false;
            }
            cr.drawImage(this.transform.getXfm(), this.canvas, 0, 0, this.canvas.width, this.canvas.height, this.canvas.width, this.canvas.height, this.opacity, false);
        };
        /**
         * Get the actor who owns the component
         */
        VectorGraphics.prototype.getActor = function () {
            return this.actor;
        };
        /**
         * Get the string name of the component
         */
        VectorGraphics.prototype.getName = function () {
            return exports.Components.VectorGraphics;
        };
        /**
         * Prepare the current instruction set for use.
         */
        VectorGraphics.prototype.prepare = function () {
            this.instructions = this.prevInstructions.splice(0, this.prevInstructions.length);
            this.instructions.push(this.beginIns);
            if (this.activeInstructions.fillInstructions != null) {
                this.instructions = this.instructions.concat(this.activeInstructions.fillInstructions);
            }
            if (this.activeInstructions.strokeInstructions != null) {
                this.instructions = this.instructions.concat(this.activeInstructions.strokeInstructions);
                if (this.activeInstructions.strokeStyleInstructions != null) {
                    this.instructions = this.instructions.concat(this.activeInstructions.strokeStyleInstructions);
                }
            }
            this.instructions = this.instructions.concat(this.activeInstructions.instructions);
            if (this.activeInstructions.fillInstructions != null) {
                this.instructions.push(this.fillIns);
            }
            if (this.activeInstructions.strokeInstructions != null) {
                this.instructions.push(this.strokeIns);
            }
        };
        /**
         * Creates a new sub-path
         */
        VectorGraphics.prototype.newPath = function () {
            if (this.dirty) {
                this.prepare();
            }
            this.prevInstructions = this.instructions;
            this.activeInstructions.instructions = new Array();
            this.active = this.dirty = false;
        };
        /**
         * Called to set properties using instructions.
         *
         * @param  name  prop name
         * @param  value  prop value
         */
        VectorGraphics.prototype.setProperty = function (name, value) {
            this[name] = value;
        };
        return VectorGraphics;
    })();
    exports.VectorGraphics = VectorGraphics;
});
