// Feature detect only. Nothing in the app imports this in PR 1.
export function detectWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch (err) {
    return false;
  }
}
