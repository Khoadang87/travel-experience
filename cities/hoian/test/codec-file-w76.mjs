export const CODECS = Object.freeze({
'e802da59e406706acd71e03a8319b104a67a147698f5da7eb0a1215a5ac47cda': {label:'Baseline encoding',bytes:10554227},
'74309688675b6d6a5c4b6c603e05d8160ef0f7f6f9a98031b6b0d220637ca3e9': {label:'Short GOP comparison',bytes:12691172}
});
export async function validateCodecFile(file, digest = data => crypto.subtle.digest('SHA-256',data)) {
 if(!file || !Object.values(CODECS).some(x=>x.bytes===file.size))throw new Error('Choose an exact reviewed comparison file.');
 const hash=Array.from(new Uint8Array(await digest(await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
 const codec=CODECS[hash];if(!codec || codec.bytes!==file.size)throw new Error('Comparison file hash does not match.');
 return {...codec,hash};
}
export function validateCodecMedia(video) {
 if(Math.abs(video.duration-35.08)>.005 || video.videoWidth!==2160 || video.videoHeight!==1080)
  throw new Error('Comparison media format or duration does not match.');
}
