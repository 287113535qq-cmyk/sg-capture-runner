import {readWorkLineArtifactsCurrent} from './work-line-artifact-reader.mjs';
// Fixed GET-only artifact consumer. Input cannot select code, commands or games.
console.log(JSON.stringify(await readWorkLineArtifactsCurrent(process.cwd())));
