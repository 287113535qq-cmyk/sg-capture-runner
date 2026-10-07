import {githubReadDiagnostic} from '../github-read-diagnostic.mjs';
import {resumeTaskDiagnostic} from './sg-resume-diagnostic.mjs';
// Preserve a supplied semantic assertion code without publishing payloads,
// sessions, stack traces or Node's generic assertion diagnostic text.
export function protocolFaultCode(error){
 const safe=value=>typeof value==='string'&&/^[A-Z_]{1,100}$/.test(value);
 return safe(error?.message)?error.message:safe(error?.code)?error.code:'SG_PROTOCOL_STOPPED';
}

export function protocolStopReport(error){
 const result={outcome:'stopped',code:protocolFaultCode(error)},diagnostic=githubReadDiagnostic(error);
 if(diagnostic)result.githubRead=diagnostic;
 const resume=resumeTaskDiagnostic(error);if(resume)result.resumeTask=resume;return result;
}
