'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
// Real font bytes for an SDK-declared Arial default. No metrics/pixels/font
// names are fabricated, and this changes only the current Node process.
exports.bindDeclaredOriginalArial=function({Canvas,profile}) {
  assert(profile?.family==='Arial'&&profile.originalDeclaredFamily==='Arial',
    'ORIGINAL_DECLARED_ARIAL_ONLY');
  assert(typeof profile.file==='string'&&/^[a-f0-9]{64}$/.test(profile.SHA256),
    'EXACT_ORIGINAL_FONT_INPUT_REQUIRED');
  const bytes=fs.readFileSync(profile.file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),profile.SHA256,
    'ORIGINAL_FONT_BYTES_CHANGED');
  assert.equal(bytes.readUInt32BE(0),0x00010000,'ORIGINAL_TRUETYPE_INPUT_REQUIRED');
  assert(typeof Canvas?.GlobalFonts?.register==='function','ACTUAL_NATIVE_FONT_BACKEND_REQUIRED');
  const key=Canvas.GlobalFonts.register(bytes,'Arial');assert(key,'ACTUAL_ARIAL_REGISTRATION_FAILED');
  const families=Canvas.GlobalFonts.families;
  assert(Array.isArray(families),'ACTUAL_FONT_FAMILY_ARRAY_REQUIRED');
  assert(families.some(x=>x.family==='Arial'),'ACTUAL_ARIAL_FAMILY_NOT_REGISTERED');
  return Object.freeze({family:'Arial',inputSHA256:profile.SHA256,actualFontBytesRegistered:true,
    fabricatedMetrics:false,fabricatedPixels:false,otherFontsSubstituted:false});
};
