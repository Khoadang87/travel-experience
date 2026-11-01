// Approximate architectural test scene. Dimensions/layout are design estimates, not survey data.
export function buildCorner(T, maps = {}) {
  const scene = new T.Scene(); scene.background = new T.Color('#c1dbe0');
  scene.fog = new T.Fog('#c1dbe0', 35, 90);
  scene.add(new T.HemisphereLight(0xeaf8ff, 0x6d6452, 2.1));
  const sun = new T.DirectionalLight(0xfff0d0, 2.4); sun.position.set(-14, 25, 12); scene.add(sun);
  const collisions = [], solidMeshes = [];
  const materials=new Map();
  const mat = (color, map, more={}) => { const key=color+':'+(map?.uuid||'')+JSON.stringify(more);if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,map:map||null,roughness:.95,...more}));return materials.get(key) };
  const red = mat('#a64e42'), ochre = mat('#ddbc62', maps.yellow_plaster);
  const tile = mat('#766554', maps.roof_tiles), wood = mat('#574436', maps.wood);
  const stone = mat('#aaa18c', maps.stone), pavement = mat('#b3afa0', maps.pavement);
  const plaster = mat('#d0c8ad'), trim = mat('#bfaa77'), dark = mat('#283329');
  function box(w,h,d,x,y,z,m,collision=false) {
    const o = new T.Mesh(new T.BoxGeometry(w,h,d),m); o.position.set(x,y,z); scene.add(o);
    if(collision) {collisions.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});solidMeshes.push(o)} return o;
  }
  function cylinder(rt,rb,h,x,y,z,m,n=10) {
    const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,n),m);o.position.set(x,y,z);scene.add(o);return o;
  }
  // Continuous dry banks and a clearly visible water channel. Navigation rejects water outside the bridge.
  box(100,.3,100,0,-.72,0,mat('#7fa6a0'));
  box(100,.3,43,0,-.15,25.5,pavement);box(100,.3,43,0,-.15,-25.5,pavement);
  box(100,.18,.45,0,-.02,4.2,stone);box(100,.18,.45,0,-.02,-4.2,stone);
  const water = box(100,.04,8,0,-.35,0,mat('#7aa29c',maps.water,{roughness:.3,metalness:.12}));
  // Small quay walls descend to the water instead of exposing a black void.
  box(100,.65,.3,0,-.30,4.03,stone);box(100,.65,.3,0,-.30,-4.03,stone);
  // Crossing and two gentle approach ramps.
  box(4.2,.36,10.4,0,.18,0,stone);
  function ramp(z,sign) {
    const g=new T.BufferGeometry();const x=2.1,a=z,b=z+sign*1.5;
    g.setAttribute('position',new T.Float32BufferAttribute([-x,.36,a,x,.36,a,x,0,b,-x,.36,a,x,0,b,-x,0,b],3));g.computeVertexNormals();
    scene.add(new T.Mesh(g,mat('#b3afa0',maps.pavement,{side:T.DoubleSide})));
  } ramp(5.2,1);ramp(-5.2,-1);
  // Bridge side parapets, timber framing and windows.
  for(const x of [-2.02,2.02]) {
    box(.24,1.18,10,x,.95,0,red,true);
    for(const z of [-4.6,-2.3,0,2.3,4.6]) {
      box(.26,2.4,.26,x,1.9,z,wood,true);
      box(.48,.15,.45,x,.44,z,stone);
    }
    box(.24,.2,10.5,x,3.12,0,wood);
    for(const z of [-3.45,-1.15,1.15,3.45]) box(.15,.12,1.8,x,2.48,z,wood);
  }
  function roof(cx,cz,w,d,baseY,rise,material=tile) {
    const x=w/2,z=d/2;
    const positions=[-x,baseY,-z,0,baseY+rise,-z,0,baseY+rise,z,-x,baseY,-z,0,baseY+rise,z,-x,baseY,z,0,baseY+rise,-z,x,baseY,-z,x,baseY,z,0,baseY+rise,-z,x,baseY,z,0,baseY+rise,z];
    const uv=[0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,0,1];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    const mesh=new T.Mesh(g,material);mesh.position.set(cx,0,cz);mesh.material.side=T.DoubleSide;scene.add(mesh);
    box(.24,.22,d+.15,cx,baseY+rise+.02,cz,material);
    for(const sign of [-1,1]) box(.16,.18,d+.2,cx+sign*x,baseY,cz,material);
    return mesh;
  }
  roof(0,0,5.5,11.7,3.15,1.25);
  // Physical entrance frame leaves a full-width opening to walk through.
  for(const z of [-5.12,5.12]) {
    box(.64,2.7,.45,-1.75,1.7,z,red,true);box(.64,2.7,.45,1.75,1.7,z,red,true);
    if(maps.bridge_red)for(const x of [-1.75,1.75])box(.40,1.85,.02,x,1.6,z+Math.sign(z)*.24,mat('#ffffff',maps.bridge_red));
    box(4.15,.6,.5,0,3.0,z,red);
    box(2.8,.22,.54,0,2.62,z,wood);
    box(4.6,.16,.6,0,3.36,z,trim);
    const panel=maps.bridge_ornament ? mat('#ffffff',maps.bridge_ornament) : trim;
    box(3.5,.55,.02,0,3.52,z+Math.sign(z)*.27,panel);
    for(const x of [-2.1,2.1]) {
      const ball=new T.Mesh(new T.SphereGeometry(.16,10,6),trim);ball.position.set(x,3.5,z);scene.add(ball);
    }
  }
  // Nearby facades are complete solids; their arrangement is an approximation of a Hội An corner.
  const houses=[];
  function house(x,z,w,d,h,color) {
    const wall=mat(color,maps.yellow_plaster);box(w,h,d,x,h/2,z,wall,true);
    box(w+.25,.22,d+.25,x,.11,z,stone);
    roof(x,z,w+.8,d+.8,h,.95);
    const frontX=x-Math.sign(x)*(w/2+.025);
    for(let k=-1;k<=1;k++) {
      const zz=z+k*d*.27;
      box(.07,1.65,.95,frontX,1.2,zz,dark);
      box(.12,.10,1.10,frontX,2.08,zz,wood);
      box(.10,.12,1.10,frontX,.36,zz,wood);
      for(const q of [-.46,.46]) box(.10,1.82,.08,frontX,1.22,zz+q,wood);
      if(k!==0)for(let q=-.3;q<=.31;q+=.15)box(.13,1.62,.025,frontX,1.2,zz+q,wood);
    }
    box(.18,.2,d+.25,frontX,2.65,z,wood);
    const canopy=box(1.0,.10,d*.8,frontX-Math.sign(x)*.38,2.7,z,tile);canopy.rotation.z=Math.sign(x)*.12;
    // Signboards: keep decorative geometry free of invented business names.
    box(.13,.48,1.35,frontX-Math.sign(x)*.05,2.38,z,wood);
    houses.push({x,z,w,d,h});
  }
  house(-5.9,10.1,5.0,6.5,3.5,'#dfbd68');house(6.1,10.5,5.0,6.5,4.2,'#d3b86a');
  house(-6.0,-10.5,5.2,6.5,3.8,'#d7b759');house(6.2,-10.5,5.0,6.5,3.5,'#d6b566');
  house(-13,8.2,5.5,5.0,4.0,'#c7ad65');house(13,8.2,5.5,5.0,3.7,'#d8c089');
  house(-13,-8.4,5.5,5.2,3.7,'#c8b270');house(13,-8.4,5.5,5.2,3.9,'#d8bc72');
  // Background architecture closes every view beyond the movement area.
  for(const x of [-22,-16,-10,-4,4,10,16,22]) {
    box(5.8,4.8,5,x,2.4,21,mat('#c7b277',maps.yellow_plaster));roof(x,21,6.3,5.6,4.8,1.1);
    box(5.8,4.1,5,x,2.05,-21,mat('#cfba82',maps.yellow_plaster));roof(x,-21,6.3,5.6,4.1,1.05);
  }
  // Suspended lanterns and planted corners give depth cues in every movement direction.
  const lanternMats=['#ba5144','#cf9163','#688d68','#d5b76f'].map(c=>mat(c));
  function lantern(x,y,z,index) {
    cylinder(.018,.018,.28,x,y+.40,z,wood,6);
    const globe=new T.Mesh(new T.SphereGeometry(.22,12,8),lanternMats[((index%4)+4)%4]);globe.scale.set(1,1.2,1);globe.position.set(x,y,z);scene.add(globe);
    cylinder(.055,.055,.06,x,y+.25,z,wood,8);cylinder(.055,.055,.06,x,y-.25,z,wood,8);
    cylinder(.012,.012,.25,x,y-.40,z,lanternMats[((index%4)+4)%4],6);
  }
  for(const z of [-10,-7,7,10,13]) {
    const pts=[];for(let k=0;k<=16;k++){const x=-3.3+k*6.6/16;pts.push(new T.Vector3(x,3.7-.35*Math.sin(k/16*Math.PI),z))}
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0x514d42})));
    for(let k=0;k<5;k++)lantern(-2.6+k*1.3,3.05+.1*Math.cos(k),z,k+Math.round(z));
  }
  const leaf=mat('#597d50'),leaf2=mat('#6b8c59');
  for(const [x,z] of [[-9,4.9],[9,5.0],[-9,-5.1],[9,-5.1],[-17,12],[17,-12]]) {
    cylinder(.16,.23,3.0,x,1.5,z,wood);collisions.push({minX:x-.3,maxX:x+.3,minZ:z-.3,maxZ:z+.3});
    for(let k=0;k<5;k++) {
      const o=new T.Mesh(new T.IcosahedronGeometry(1.8,1),k%2?leaf:leaf2);o.position.set(x+Math.sin(k*2)*.7,3.8+(k%2)*.5,z+Math.cos(k*2)*.7);o.scale.set(1,.7,1);scene.add(o);
    }
    cylinder(.55,.75,.6,x,.3,z,mat('#a37c63'));
  }
  // Canal details are geometry, not a panoramic background moving with the camera.
  for(const [x,z] of [[-8,1],[9,-.8]]) {
    const boat=new T.Mesh(new T.SphereGeometry(1,16,8),wood);boat.scale.set(2.4,.22,.65);boat.position.set(x,-.25,z);scene.add(boat);
    box(3.9,.1,.65,x,-.01,z,mat('#957e59'));
  }
  const boundaries={minX:-18,maxX:18,minZ:-16,maxZ:16};
  function canStand(x,z,radius=.23) {
    if(x<boundaries.minX+radius||x>boundaries.maxX-radius||z<boundaries.minZ+radius||z>boundaries.maxZ-radius)return false;
    if(Math.abs(z)<4.18+radius&&Math.abs(x)>1.65-radius)return false;
    return !collisions.some(b=>x>b.minX-radius&&x<b.maxX+radius&&z>b.minZ-radius&&z<b.maxZ+radius);
  }
  const groundHeight=(x,z)=>Math.abs(x)<1.8&&Math.abs(z)<5.2?.36:Math.abs(x)<1.8&&Math.abs(z)<6.7?.36*(6.7-Math.abs(z))/1.5:0;
  // Bake static meshes into one draw per material to reduce work on mobile GPUs.
  scene.updateMatrixWorld(true);const batches=new Map();
  for(const o of [...scene.children])if(o.isMesh){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const list=batches.get(o.material)||[];list.push(g);batches.set(o.material,list);scene.remove(o)}
  for(const [material,geometries] of batches){const merged=new T.BufferGeometry();for(const attr of ['position','normal','uv']){const total=geometries.reduce((n,g)=>n+g.attributes[attr].array.length,0),a=new Float32Array(total);let offset=0;for(const g of geometries){a.set(g.attributes[attr].array,offset);offset+=g.attributes[attr].array.length}merged.setAttribute(attr,new T.BufferAttribute(a,attr==='uv'?2:3))}scene.add(new T.Mesh(merged,material));for(const g of geometries)g.dispose()}
  return {scene,collisions,boundaries,canStand,groundHeight,water,houses,spawn:[0,1.65,12]};
}
