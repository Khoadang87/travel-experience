// Feature detect for the splat viewer. Tests may set
// globalThis.__tgForceNoWebGL2 to force the 360 fallback path.
export function detectWebGL2() {
  if (typeof globalThis !== "undefined" && globalThis.__tgForceNoWebGL2) {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch (err) {
    return false;
  }
}
