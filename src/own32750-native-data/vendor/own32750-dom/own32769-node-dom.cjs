"use strict";
const pkg = require("./vendor/sax-1.6.1/package.json");
if (pkg.name !== "sax" || pkg.version !== "1.6.1")
  throw new Error("own32769 DOM dependency must be vendored sax@1.6.1");
const sax = require("./vendor/sax-1.6.1/lib/sax.js");
const owned = new WeakSet();

function fail(code, message, cause) {
  const error = new Error("own32769 Node DOM: " + message);
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  throw error;
}
function unsupported(message) {
  fail("OWN32769_DOM_UNSUPPORTED", message);
}
function characters(value) {
  const text = String(value);
  for (const character of text) {
    const n = character.codePointAt(0);
    if (!(n === 9 || n === 10 || n === 13 ||
      n >= 0x20 && n <= 0xd7ff ||
      n >= 0xe000 && n <= 0xfffd ||
      n >= 0x10000 && n <= 0x10ffff)) {
      fail("OWN32769_DOM_INVALID_CHARACTER", "Invalid XML 1.0 character");
    }
  }
  return text;
}
function attributeValue(value) {
  const text = characters(value);
  if (/[\t\r\n]/.test(text))
    unsupported("Attribute whitespace normalization is not covered");
  return text;
}
function creationName(value) {
  if (typeof value !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value))
    unsupported("Programmatic qualified/non-ASCII XML names are not covered");
  return value;
}
function list() {
  const rows = [];
  Object.defineProperty(rows, "item", {
    value(index) { return rows[index] ?? null; }
  });
  return rows;
}
function descendants(parent, name) {
  if (typeof name !== "string") unsupported("Non-string tag query");
  const result = list();
  for (const child of parent.childNodes) {
    if (child.nodeType !== 1) continue;
    if (name === "*" || child.nodeName === name) result.push(child);
    result.push(...descendants(child, name));
  }
  return result;
}
function makeAttribute(document, name, value, ns = {}) {
  let stored = attributeValue(value);
  const attr = {
    nodeType: 2, nodeName: name, name, ownerDocument: document,
    ownerElement: null,
    namespaceURI: ns.uri || null,
    prefix: ns.prefix || null,
    localName: ns.local || name,
    get value() { return stored; },
    set value(next) { stored = attributeValue(next); },
    get nodeValue() { return stored; },
    set nodeValue(next) { stored = attributeValue(next); }
  };
  owned.add(attr);
  return attr;
}
function namedAttributes(element) {
  const rows = list();
  Object.defineProperties(rows, {
    getNamedItem: {
      value(name) { return rows.find(attr => attr.nodeName === name) ?? null; }
    },
    setNamedItem: {
      value(attr) {
        if (!owned.has(attr) || attr.nodeType !== 2 ||
            attr.ownerDocument !== element.ownerDocument)
          unsupported("Foreign attribute/document");
        if (attr.ownerElement && attr.ownerElement !== element)
          unsupported("Attribute already belongs to another element");
        const previous = rows.getNamedItem(attr.nodeName);
        if (previous) {
          rows[rows.indexOf(previous)] = attr;
          previous.ownerElement = null;
        } else rows.push(attr);
        attr.ownerElement = element;
        return previous;
      }
    }
  });
  return rows;
}
function makeNode(document, type, name, value = null, ns = {}) {
  let stored = value === null ? null : characters(value);
  const node = {
    nodeType: type, nodeName: name, ownerDocument: document,
    parentNode: null, childNodes: list(),
    namespaceURI: ns.uri || null,
    prefix: ns.prefix || null,
    localName: type === 1 ? ns.local || name : null,
    get firstChild() { return this.childNodes[0] ?? null; },
    get nodeValue() { return type === 1 || type === 9 ? null : stored; },
    set nodeValue(next) {
      if (type === 1 || type === 9) unsupported("Element/document nodeValue mutation");
      const text = characters(next);
      if (type === 4 && text.includes("]]>")) unsupported("CDATA terminator in data");
      if (type === 8 && (text.includes("--") || text.endsWith("-")))
        unsupported("Invalid comment data");
      if (type === 7 && text.includes("?>")) unsupported("Invalid PI data");
      stored = text;
    },
    get textContent() {
      if ([3, 4, 7, 8].includes(type)) return stored;
      return this.childNodes.filter(child => [1, 3, 4].includes(child.nodeType))
        .map(child => child.textContent).join("");
    },
    set textContent(next) {
      // Only this owned, unqualified Element and explicit string input.
      // Native GLS CurrencyMultiplierPayload supplies multiplier.toString().
      if (type !== 1 || this !== node || !owned.has(this) ||
          this.nodeType !== 1 || this.ownerDocument !== document)
        unsupported("textContent replacement requires the owned Element");
      if (this.namespaceURI || this.prefix ||
          this.attributes.some(attr => attr.namespaceURI))
        unsupported("Namespace textContent replacement is not covered");
      if (typeof next !== "string")
        unsupported("Only string Element.textContent replacement is covered");

      // Validate before changing links or the existing NodeList.
      const text = characters(next);
      const children = Array.from(this.childNodes);
      if (new Set(children).size !== children.length ||
          children.some(child => !owned.has(child) ||
            child.ownerDocument !== document || child.parentNode !== this ||
            ![1, 3, 4, 7, 8].includes(child.nodeType)))
        unsupported("Invalid owned Element children");
      const replacement = text === ""
        ? null : makeNode(document, 3, "#text", text);
      for (const child of children) child.parentNode = null;
      this.childNodes.splice(
        0, this.childNodes.length, ...(replacement ? [replacement] : [])
      );
      if (replacement) replacement.parentNode = this;
    },
    getElementsByTagName(name) { return descendants(this, name); },
    appendChild(child) {
      if (!owned.has(child) || ![1, 9].includes(type) ||
          ![1, 3, 4, 7, 8].includes(child.nodeType))
        unsupported("Unsupported child node");
      const targetDocument = type === 9 ? this : this.ownerDocument;
      if (child.ownerDocument !== targetDocument)
        unsupported("Cross-document append");
      for (let parent = this; parent; parent = parent.parentNode)
        if (parent === child) unsupported("Node cycle");
      if (type === 9 &&
          (![1, 7, 8].includes(child.nodeType) ||
           child.nodeType === 1 && this.documentElement &&
           this.documentElement !== child))
        unsupported("Invalid XML document children");
      if (child.parentNode) child.parentNode.removeChild(child);
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index < 0) unsupported("Child is not present");
      this.childNodes.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    cloneNode() { unsupported("cloneNode is not covered"); },
    getElementsByTagNameNS() { unsupported("Namespace query API is not covered"); },
    querySelector() { unsupported("Selector API is not covered"); },
    querySelectorAll() { unsupported("Selector API is not covered"); }
  };
  if (type === 1) {
    node.tagName = name;
    node.attributes = namedAttributes(node);
    node.getAttribute = function (key) {
      const attr = this.attributes.getNamedItem(key);
      return attr ? attr.value : null;
    };
    node.setAttribute = function (key, next) {
      const attr = this.ownerDocument.createAttribute(key);
      attr.value = next;
      this.attributes.setNamedItem(attr);
    };
  }
  owned.add(node);
  return node;
}

const implementation = Object.freeze({
  createDocument(namespaceURI, qualifiedName, doctype) {
    if (namespaceURI !== "" && namespaceURI !== null)
      unsupported("Namespace creation is not covered");
    if (doctype !== null) unsupported("DOCTYPE creation is not covered");
    const document = makeDocument();
    if (qualifiedName !== null && qualifiedName !== "")
      document.appendChild(document.createElement(qualifiedName));
    return document;
  }
});
function makeDocument() {
  const document = makeNode(null, 9, "#document");
  Object.defineProperty(document, "documentElement", {
    get() { return this.childNodes.find(child => child.nodeType === 1) ?? null; }
  });
  document.implementation = implementation;
  document.createElement = name =>
    makeNode(document, 1, creationName(name));
  document.createAttribute = name =>
    makeAttribute(document, creationName(name), "");
  document.createTextNode = text => makeNode(document, 3, "#text", text);
  document.createCDATASection = text => {
    if (String(text).includes("]]>")) unsupported("CDATA terminator in data");
    return makeNode(document, 4, "#cdata-section", text);
  };
  document.createComment = text => {
    const value = characters(text);
    if (value.includes("--") || value.endsWith("-"))
      unsupported("Invalid comment data");
    return makeNode(document, 8, "#comment", value);
  };
  document.createProcessingInstruction = (target, body) => {
    creationName(target);
    if (target.toLowerCase() === "xml" || String(body).includes("?>"))
      unsupported("Invalid processing instruction");
    return makeNode(document, 7, target, body);
  };
  document.createElementNS = () => unsupported("Namespace creation is not covered");
  document.createAttributeNS = () => unsupported("Namespace creation is not covered");
  document.importNode = () => unsupported("importNode is not covered");
  document.adoptNode = () => unsupported("adoptNode is not covered");
  document.createDocumentFragment = () => unsupported("DocumentFragment is not covered");
  return document;
}

class DOMParser {
  parseFromString(input, mime) {
    if (typeof input !== "string" || mime !== "text/xml")
      unsupported("Only string text/xml input is covered");
    characters(input);
    // XML 1.0 literal line-end normalization, before entity decoding.
    const xml = input.replace(/\r\n?/g, "\n");
    const document = makeDocument();
    const stack = [document];
    let attributes = [], names = new Set(), expanded = new Set();
    let cdata = null, declaration = false;
    const parser = sax.parser(true, {
      trim: false, normalize: false, xmlns: true, strictEntities: true
    });
    parser.onopentagstart = () => {
      attributes = []; names = new Set(); expanded = new Set();
    };
    parser.onattribute = attr => {
      const key = attr.uri + "\0" + attr.local;
      if (names.has(attr.name) || expanded.has(key))
        fail("OWN32769_DOM_DUPLICATE_ATTRIBUTE", "Duplicate XML attribute");
      names.add(attr.name); expanded.add(key);
      attributes.push(makeAttribute(document, attr.name, attr.value, attr));
    };
    parser.onopentag = tag => {
      const element = makeNode(document, 1, tag.name, null, tag);
      for (const attr of attributes) element.attributes.setNamedItem(attr);
      stack[stack.length - 1].appendChild(element);
      stack.push(element);
    };
    parser.onclosetag = () => { stack.pop(); };
    parser.ontext = text => {
      const parent = stack[stack.length - 1];
      if (parent === document) {
        if (!/^[ \t\n\r]*$/.test(text))
          fail("OWN32769_DOM_PARSE_ERROR", "Text outside document element");
        return;
      }
      const previous = parent.childNodes[parent.childNodes.length - 1];
      if (previous && previous.nodeType === 3) previous.nodeValue += text;
      else parent.appendChild(document.createTextNode(text));
    };
    parser.onopencdata = () => {
      cdata = document.createCDATASection("");
      stack[stack.length - 1].appendChild(cdata);
    };
    parser.oncdata = text => {
      if (!cdata) fail("OWN32769_DOM_PARSE_ERROR", "Unexpected CDATA event");
      cdata.nodeValue += text;
    };
    parser.onclosecdata = () => { cdata = null; };
    parser.oncomment = text => {
      stack[stack.length - 1].appendChild(document.createComment(text));
    };
    parser.onprocessinginstruction = instruction => {
      if (instruction.name.toLowerCase() === "xml") {
        if (!/^\uFEFF?<\?xml[\t\r\n ]/.test(xml) ||
            instruction.name !== "xml" || declaration ||
            document.childNodes.length || stack.length !== 1 ||
            !/^version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?(?:\s+standalone\s*=\s*(?:"(?:yes|no)"|'(?:yes|no)'))?\s*$/.test(instruction.body))
          unsupported("Only an initial XML 1.0 declaration is covered");
        declaration = true;
      } else {
        stack[stack.length - 1].appendChild(
          document.createProcessingInstruction(instruction.name, instruction.body)
        );
      }
    };
    parser.ondoctype = () => unsupported("DOCTYPE/entity declarations are not covered");
    parser.onsgmldeclaration = () => unsupported("SGML declarations are not covered");
    parser.onerror = error => { throw error; };
    try {
      parser.write(xml).close();
      if (!document.documentElement || stack.length !== 1)
        fail("OWN32769_DOM_PARSE_ERROR", "Incomplete XML document");
      return document;
    } catch (error) {
      if (error && typeof error.code === "string" && error.code.startsWith("OWN32769_DOM_"))
        throw error;
      fail("OWN32769_DOM_PARSE_ERROR", "Strict SAX XML parse failed", error);
    }
  }
}

function escapeXML(value, attr = false) {
  let text = characters(value).replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (attr) text = text.replace(/"/g, "&quot;");
  return text;
}
class XMLSerializer {
  serializeToString(root) {
    const path = new Set();
    const serialize = node => {
      if (!owned.has(node)) unsupported("Foreign DOM node");
      if (path.has(node)) unsupported("Node cycle");
      path.add(node);
      try {
        if (node.nodeType === 9)
          return node.childNodes.map(serialize).join("");
        if (node.nodeType === 1) {
          if (node.namespaceURI || node.attributes.some(attr => attr.namespaceURI))
            unsupported("Namespace serialization is not covered");
          const attrs = node.attributes.map(attr =>
            ' ' + attr.nodeName + '="' + escapeXML(attr.value, true) + '"'
          ).join("");
          return "<" + node.nodeName + attrs +
            (node.childNodes.length
              ? ">" + node.childNodes.map(serialize).join("") + "</" + node.nodeName + ">"
              : "/>");
        }
        if (node.nodeType === 3)
          return escapeXML(node.nodeValue).replace(/\r/g, "&#13;");
        if (node.nodeType === 4) return "<![CDATA[" + node.nodeValue + "]]>";
        if (node.nodeType === 8) return "<!--" + node.nodeValue + "-->";
        if (node.nodeType === 7)
          return "<?" + node.nodeName + (node.nodeValue ? " " + node.nodeValue : "") + "?>";
        unsupported("Node serialization is not covered");
      } finally { path.delete(node); }
    };
    return serialize(root);
  }
}
module.exports = Object.freeze({
  DOMParser, XMLSerializer, implementation,
  contract: Object.freeze({
    dependency: "sax@1.6.1",
    xmlVersion: "1.0",
    snapshotNodeLists: true,
    namespaceCreation: false,
    namespaceSerialization: false
  })
});

