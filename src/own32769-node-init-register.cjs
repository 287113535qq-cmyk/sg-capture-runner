"use strict";
const { DOMParser, XMLSerializer } = require("./own32769-node-dom.cjs");
const {
  createOwn32769FirstNormalInitData
} = require("./own32769-first-normal-Init-factory-seam-private.cjs");

function installOwn32769NodeInit({ bindOwn32769InitDataFactory }) {
  if (typeof bindOwn32769InitDataFactory !== "function")
    throw new TypeError("Actual private original-factory binder is required");
  return bindOwn32769InitDataFactory((session, source) =>
    createOwn32769FirstNormalInitData({
      originalSessionScope: session,
      originalFactoryInitSource: source,
      DOMParser,
      XMLSerializer
    }).parseOriginalFactoryInit()
  );
}
module.exports = Object.freeze({ installOwn32769NodeInit });

