'use strict';
const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
// Private own32750 environment proposal. Never modifies the shared helper file.
function loadOwn32750DOMPort(basePath){
 const base=fs.readFileSync(basePath,'utf8');
 const oldCheck="if (!owned.has(attr) || attr.nodeType !== 2 ||\n            attr.ownerDocument !== element.ownerDocument)\n          unsupported(\"Foreign attribute/document\");";
 if(!base.includes(oldCheck))throw Error('OWN32750_BASE_DOM_CONTRACT_CHANGED');
 const candidate=base.replace(oldCheck,'if (!owned.has(attr) || attr.nodeType !== 2)\n          unsupported("Foreign attribute/document");').replace('const previous = rows.getNamedItem(attr.nodeName);','attr.ownerDocument = element.ownerDocument;\n        const previous = rows.getNamedItem(attr.nodeName);');
 const module={exports:{}};
 new vm.Script('(function(require,module,exports){'+candidate+'\n})',{filename:'own32750-private-DOM-attribute-adoption.cjs'}).runInThisContext()(createRequire(basePath),module,module.exports);
 return module.exports;
}
module.exports={loadOwn32750DOMPort};
