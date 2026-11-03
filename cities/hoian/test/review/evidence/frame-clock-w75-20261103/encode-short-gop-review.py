import hashlib,subprocess,sys
from pathlib import Path
source=Path(sys.argv[1]);output=Path(sys.argv[2])
assert hashlib.sha256(source.read_bytes()).hexdigest()=='8742afb41f2d2fad7dfebd39e8fe7e89645201b9cc2d589be6b2b2d45302e3e2', 'wrong original source'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(source),'-r','25','-an','-c:v','libx264','-preset','slow','-crf','32','-g','25','-keyint_min','25','-sc_threshold','0','-pix_fmt','yuv420p','-movflags','+faststart','-n',str(output)],check=True)
print(hashlib.sha256(output.read_bytes()).hexdigest())
