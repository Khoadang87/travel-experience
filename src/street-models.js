// Catalogue of the CC0 street-crowd glTF files. Kyoto does not use this.
// See media/models/ATTRIBUTION.md.

export const STREET_PEOPLE = {
  "casual-walker": "media/models/people/casual-walker.glb",
  "dog-walker": "media/models/people/dog-walker.glb",
  "hiker": "media/models/people/hiker.glb",
  "cyclist": "media/models/people/cyclist.glb",
  "road-worker": "media/models/people/road-worker.glb",
};

export const STREET_CARS = {
  hatchback: "media/models/cars/hatchback.glb",
  suv: "media/models/cars/suv.glb",
  "estate-car": "media/models/cars/estate-car.glb",
};

export const WALK_DESIGN_SPEED = 1.3;

const WHEEL_NAMES = new Set(["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]);

export function resolveStreetModel(kind, name) {
  const table = kind === "car" ? STREET_CARS : STREET_PEOPLE;
  if (!name) return null;
  return table[name] || null;
}

export function findNamedNodes(root, names) {
  const want = names instanceof Set ? names : new Set(names);
  const found = {};
  root.traverse((obj) => {
    if (obj.name && want.has(obj.name) && !found[obj.name]) found[obj.name] = obj;
  });
  return found;
}

export function findWheels(root) {
  const wheels = [];
  const named = findNamedNodes(root, WHEEL_NAMES);
  for (const key of ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]) {
    const node = named[key];
    if (!node) continue;
    const rest = node.quaternion.clone();
    // Approximate rolling radius from the wheel's world size at rest.
    node.updateWorldMatrix(true, false);
    const box = new (root.constructor.Box3 ? root.constructor : Object)();
    // Caller passes THREE later; compute a fallback radius if needed.
    wheels.push({ node, rest, radius: 0.33, spin: 0 });
  }
  return wheels;
}

export function collectWheels(root, THREE) {
  const wheels = [];
  const named = findNamedNodes(root, WHEEL_NAMES);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  for (const key of ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]) {
    const node = named[key];
    if (!node) continue;
    node.updateWorldMatrix(true, false);
    box.setFromObject(node);
    box.getSize(size);
    const radius = Math.max(0.16, Math.min(0.45, 0.5 * Math.max(size.y, size.z, size.x) || 0.33));
    wheels.push({ node, rest: node.quaternion.clone(), radius, spin: 0 });
  }
  return wheels;
}
