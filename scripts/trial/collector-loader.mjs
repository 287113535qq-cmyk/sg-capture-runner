import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const files=Object.freeze({nextgen:'sg.ingest.ts',rhino:'sg.rhino.ts',pearl:'sg.pearl.ts',
 pearlRetrigger:'sg.pearl-retrigger.ts',pearlAward:'sg.pearl-award.ts',pyramidsAction:'sg.pyramids-action.ts',pyramidsDirectAction:'sg.pyramids-direct-action.ts',pyramidsResumeAction:'sg.pyramids-resume-action.ts'});
const cached=new Map();
// AG workers load their selected game handler. Keep each independent process
// isolated, but avoid compiling unrelated collector families at startup.
export function captureCollector(kind){
 if(!Object.hasOwn(files,kind))throw Error('UNKNOWN_CAPTURE_COLLECTOR');
 if(!cached.has(kind))cached.set(kind,require('../../collector/'+files[kind]));
 return cached.get(kind);
}
let parser;
export function captureXmlParser(){
 if(!parser){const {XMLParser}=require('../../collector/node_modules/fast-xml-parser');
  parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});}
 return parser;
}
