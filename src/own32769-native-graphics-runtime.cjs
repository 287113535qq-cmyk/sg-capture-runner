"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {DOMParser, XMLSerializer, implementation} =
  require("./own32769-node-dom.cjs");

function createOwn32769NativeRuntime({httpconnection, maxDrawingCommands}) {
  if (!Number.isSafeInteger(maxDrawingCommands) || maxDrawingCommands <= 0)
    throw new TypeError("Explicit bounded drawing capacity required");
  const commands = [], deferredTimers = new Map();
  let retiredDrawingCount = 0;
  let lastRetirement;

  let drawingTime = 0, nextTimer = 1;
  const epoch = Date.now();

  function draw(name, args) {
    if (commands.length >= maxDrawingCommands)
      throw new Error("Own drawing command capacity reached");
    commands.push(Object.freeze({name, args: Array.from(args)}));
  }
  function gradient(kind, args) {
    return {
      kind, coordinates: Array.from(args), stops: [],
      addColorStop(offset, color) { this.stops.push({offset, color}); }
    };
  }
  function context2d() {
    const out = {
      createLinearGradient(...args) { return gradient("linear", args); },
      createRadialGradient(...args) { return gradient("radial", args); },
      createPattern(...args) { return {kind: "pattern", args}; },
      measureText() { throw new Error("Raster text metrics are not a model input"); },
      getImageData() { throw new Error("Raster hit testing is not supplied"); },
      isPointInPath() { throw new Error("Raster hit testing is not supplied"); }
    };
    for (const name of [
      "save", "restore", "setTransform", "transform", "translate", "rotate", "scale",
      "clearRect", "fillRect", "strokeRect", "drawImage", "beginPath", "closePath",
      "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo",
      "rect", "fill", "stroke", "clip", "fillText", "strokeText", "setLineDash"
    ]) out[name] = (...args) => draw(name, args);
    return out;
  }
  const head = {
    children: [],
    appendChild(value) {
      this.children.push(value);
      value.parentNode = this;
      return value;
    },
    removeChild(value) {
      this.children.splice(this.children.indexOf(value), 1);
    }
  };
  function element(tag) {
    const item = {
      tagName: String(tag).toUpperCase(), nodeType: 1, style: {},
      children: [], parentNode: null,
      appendChild(value) {
        this.children.push(value);
        value.parentNode = this;
        return value;
      },
      removeChild(value) {
        this.children.splice(this.children.indexOf(value), 1);
      },
      setAttribute(name, value) { this[name] = value; },
      getAttribute(name) { return this[name] ?? null; },
      addEventListener() {},
      removeEventListener() {}
    };
    if (tag === "canvas") {
      const ctx = context2d();
      item.width = item.height = 1;
      item.getContext = type => {
        if (type !== "2d")
          throw new Error("Only drawing command sink is supplied");
        return ctx;
      };
      ctx.canvas = item;
    }
    return item;
  }
  const document = {
    implementation, head, body: head, documentElement: element("html"),
    createElement: element,
    createElementNS(_namespace, tag) { return element(tag); },
    createTextNode(value) {
      return {nodeType: 3, nodeValue: String(value)};
    },
    getElementsByTagName(tag) { return tag === "head" ? [head] : []; },
    addEventListener() {},
    removeEventListener() {}
  };
  function DrawingDate(...args) {
    return new Date(...(args.length ? args : [epoch + drawingTime]));
  }
  DrawingDate.now = () => epoch + drawingTime;
  DrawingDate.parse = Date.parse;
  DrawingDate.UTC = Date.UTC;
  DrawingDate.prototype = Date.prototype;

  function schedule(callback, delay) {
    const id = nextTimer++;
    deferredTimers.set(id, {callback, delay});
    return id;
  }
  const scope = {
    console, document, DOMParser, XMLSerializer, Date: DrawingDate,
    performance: {now: () => epoch + drawingTime},
    navigator: {userAgent: "own-native-drawing-command-sink"},
    setTimeout: schedule,
    clearTimeout: id => deferredTimers.delete(id),
    setInterval: schedule,
    clearInterval: id => deferredTimers.delete(id),
    requestAnimationFrame: callback => schedule(callback, 0),
    cancelAnimationFrame: id => deferredTimers.delete(id),
    addEventListener() {},
    removeEventListener() {},
    fetch() {
      throw new Error("Provider transport is owned by original AG");
    },
    XMLHttpRequest: function () {
      throw new Error("XHR is not part of native model DATA");
    },
    __nativeModules: Object.create(null)
  };
  scope.window = scope.self = scope.global = scope;
  const sandbox = vm.createContext(scope);

  function run(relative) {
    const code = fs.readFileSync(path.join(__dirname, relative), "utf8");
    return new vm.Script(code, {filename: relative})
      .runInContext(sandbox, {timeout: 5000});
  }
  function amd(relative, dependencies) {
    const result = {};
    scope.define = function (names, factory) {
      if (!Array.isArray(names))
        throw new Error("Expected own AMD dependency list");
      const values = names.map(name => {
        if (name === "require")
          return function () { throw new Error("Dynamic AMD load disabled"); };
        if (name === "exports") return result;
        if (!Object.prototype.hasOwnProperty.call(dependencies, name))
          throw new Error("Unbound native AMD dependency: " + name);
        return dependencies[name];
      });
      factory(...values);
    };
    run(relative);
    return result;
  }

  run("vendor/own-fudaole/createjs-state.js");
  // Use the original initializer; do not fabricate Ticker internals.
  // Its scheduled callback stays in this runtime's deferred timer map.
  scope.createjs.Ticker.init();
  delete scope.define;
  scope.module = {exports: {}};
  scope.exports = scope.module.exports;
  run("vendor/own-fudaole/gsap/TweenLite.js");
  const gsapExports = scope.module.exports;
  scope.TweenLite = scope.TweenLite || gsapExports.TweenLite ||
    (typeof gsapExports === "function" ? gsapExports : undefined);
  delete scope.module;
  delete scope.exports;
  run("vendor/own-fudaole/gsap/TweenMax-core.js");
  run("vendor/own-fudaole/gsap/TimelineLite-core.js");
  run("vendor/own-fudaole/gsap/TimelineMax-core.js");
  if (typeof scope.TweenMax !== "function" ||
      scope.TweenMax === scope.TweenLite)
    throw new Error("Cached native TweenMax declaration was not exported");
  if (typeof scope.TweenLite !== "function")
    throw new Error("Cached native TweenLite was not exported");

  const events = amd("vendor/own-fudaole/events/events.js", {
    "util/util": {
      ErrorReporter: {
        showError(code, message) {
          throw new Error("Native event failure: " + code + " " + message);
        }
      }
    }
  });
  const gamedata = amd("vendor/own-fudaole/game-data/game-data.js", {});
  const glscomms = amd("vendor/own-fudaole/gls-comms/gls-comms.js", {
    "events/events": events,
    "game-data/game-data": gamedata,
    "http-connection/http-connection": httpconnection
  });
  const asset = amd("vendor/own-fudaole/asset/asset.js", {
    "events/events": events,
    "http-connection/http-connection": httpconnection
  });
  const locale = amd("vendor/own-fudaole/locale/locale.js", {});
  Object.assign(scope.__nativeModules, {
    "events/events": events,
    "game-data/game-data": gamedata,
    "gls-comms/gls-comms": glscomms
  });
  run("native-fudaole-pick-cache.js");
  const createjs = scope.createjs;
  const canvas = element("canvas");
  canvas.width = scope.fudaole.Config.SCREEN_WIDTH;
  canvas.height = scope.fudaole.Config.SCREEN_HEIGHT;
  const root = new createjs.Stage(canvas);

  return Object.freeze({
    events, gamedata, glscomms, asset, locale,
    createjs, TweenLite: scope.TweenLite, TweenMax: scope.TweenMax,
    namespace: scope.fudaole,
    metadataBundle: new scope.fudaole.MetaDataBundle(),
    fontCacheBytes: fs.readFileSync(path.join(
      __dirname, "vendor/own-fudaole/resources/fonts/MyriadPro-Bold.otf"
    )),
    document, root,
    recordDrawing: draw,
    readNativeDrawingRecordState() {
      const activeCallbacks = {};
      for (const item of commands) {
        if (item.name.startsWith("nativeCallback."))
          activeCallbacks[item.name] = (activeCallbacks[item.name] || 0) + 1;
      }
      return Object.freeze({
        active: commands.length, totalRetired: retiredDrawingCount,
        activeCallbacks: Object.freeze(activeCallbacks),
        lastRetirement
      });
    },
    retireDrawingCommandsAfterNativeEnd() {
      const callbacks = {};
      for (const item of commands) {
        if (item.name.startsWith("nativeCallback."))
          callbacks[item.name] = (callbacks[item.name] || 0) + 1;
      }
      const retired = commands.length;
      retiredDrawingCount += retired;
      commands.length = 0;
      lastRetirement = Object.freeze({
        retired, callbacks: Object.freeze(callbacks)
      });
      return lastRetirement;
    },
    readDrawingCommands: () => Object.freeze(commands.slice()),
    stepPresentation(milliseconds, maxSteps) {
      if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 ||
          !Number.isSafeInteger(maxSteps) || maxSteps <= 0)
        throw new TypeError("Explicit finite presentation step required");
      let remaining = milliseconds, steps = 0;
      while (remaining > 0) {
        if (++steps > maxSteps)
          throw new Error("Native presentation step bound reached");
        const delta = Math.min(remaining, 16);
        drawingTime += delta;
        const event = new createjs.Event("tick");
        Object.assign(event, {
          delta, paused: false, time: drawingTime, runTime: drawingTime
        });
        root._tick(event);
        createjs.Ticker._tick();
        scope.TweenLite.ticker.tick();
        remaining -= delta;
      }
      return Object.freeze({drawingTime, steps});
    }
  });
}
module.exports = Object.freeze({createOwn32769NativeRuntime});

