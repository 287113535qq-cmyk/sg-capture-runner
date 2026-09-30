// Assertions carry ERR_ASSERTION even when their message is a safe domain code.
// Preserve only fixed uppercase codes; arbitrary messages may contain secrets.
export function failureCode(error){
 if(error?.code==='ERR_ASSERTION'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.message||''))return error.message;
 return /^[A-Z_]{1,80}$/.test(error?.code||'')?error.code:'TRIAL_RUN_FAILED';
}
