from pathlib import Path
import ast,json,numpy as np,hashlib
r=Path(__file__).parent
# Load diagnostic definitions without rerunning source extraction.
tree=ast.parse((r/'check_direction.py').read_text());nodes=[]
for node in tree.body:
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='sources' for t in node.targets):break
 nodes.append(node)
ns={'__file__':str(r/'check_direction.py')};exec(compile(ast.Module(body=nodes,type_ignores=[]),'check_direction.py','exec'),ns)
rng=np.random.default_rng(73);im=rng.integers(0,256,(342,512,3),dtype=np.uint8);checks=[]
for dx,dy in [(3,0),(-4,2)]:
 shifted=np.roll(im,(dy,dx),(0,1));tracks=ns['patches'](im,shifted);correct=sum(t['delta']==[dx,dy] for t in tracks)
 checks.append({'synthetic_translation':[dx,dy],'accepted_tracks':len(tracks),'exact_correct_tracks':correct,'pass':len(tracks)>20 and correct==len(tracks)})
assert all(c['pass'] for c in checks)
(r/'diagnostic-validation.json').write_text(json.dumps({'scope':'Synthetic screen-patch tracking sanity only; not runtime/player/3D acceptance','checks':checks},indent=2)+'\n')
p=r/'direction-flow-report.json';j=json.loads(p.read_text());j['assessments']=['Source-to-view axis equation is internally consistent: yaw=pi/2-h maps center u=.5+h/(2pi). This is coordinate consistency, not proof of travel direction.','At the three sampled headings, actual perspective pictures do not show an obvious180-degree reversal. Main entry and return entry face along visible streets.','All six frame pairs have right-side median horizontal flow greater than left-side median, consistent with an expansion component; common drift, camera turns, parallax, vegetation and pedestrians prevent treating this as recovered3D translation.','No evidence from these samples justifies removing the coverage gate or claiming the original iPhone failure fixed.'];j['limitations']=['Offline analysis projection uses exact75-degree vertical FOV, chosen512x342 aspect, held initial yaw and actual source pixels. It is not exact browser rendering or timing/smoothness evidence.','Main global times1066.2/1102 are inherited nominal source mappings, not reverified HLS timeline positions.','Only3 short local spans; full route heading acceptance, independent advisor and real iPhone evidence absent.','Harris/NCC may track moving objects and repeated patterns; no calibration, essential matrix or geographic pose solved.'];j['heading_provenance']={'main_commit':'5d34cec2032a4190be4bf071dbf8c0a04825f68d','main_heading_sha256':hashlib.sha256((r/'heading-main-source-commit.json').read_bytes()).hexdigest(),'return_heading_sha256':hashlib.sha256((r.parent/'hoian-player-w73/heading-return-w73.json').read_bytes()).hexdigest(),'live_mutable_dependency_lock_established':False};j['player_source_sha256']='61d436c2547b75637ab4c4763da12d878b8ce1c7cf4d5b6f7e5990115a75eac3';j['delivery_approved']=False;j['phone_testing_ready']=False
j['contact']={'file':'heading-picture-contact.jpg','bytes':(r/'heading-picture-contact.jpg').stat().st_size,'sha256':hashlib.sha256((r/'heading-picture-contact.jpg').read_bytes()).hexdigest(),'git_blob_sha1':hashlib.sha1(('blob '+str((r/'heading-picture-contact.jpg').stat().st_size)+'\0').encode()+(r/'heading-picture-contact.jpg').read_bytes()).hexdigest()};p.write_text(json.dumps(j,indent=2)+'\n');print(json.dumps({'checks':checks,'contact':j['contact']}))
(r/'HANDOFF-direction-w73-20261103.md').write_text('''# w73 source-heading sanity review — 2026-11-03

Runtime, route bounds and coverage gate unchanged. Source lock61d436c2547b75637ab4c4763da12d878b8ce1c7cf4d5b6f7e5990115a75eac3. This is offline source-picture analysis, not exact browser/GPU/iPhone evidence.

Fetched main heading table from exact player source commit5d34cec2032a4190be4bf071dbf8c0a04825f68d. Center-ray math agrees with the table conversion: yaw=pi/2-h samples panorama u=.5+h/(2pi). This rules out an obvious sign inconsistency in the inspected equation only.

Projected actual saved source frames at three initial headings, each held constant for0.4 seconds: recovered main local8.2..8.6 (inherited nominal1066.2), intact bridge review local0..0.4 (inherited1102), and exact return local5..5.4. First pictures face along the visible streets rather than showing an obvious180-degree reversal. Nine projected pictures and six sparse screen-flow pairs are recorded. All pairs show greater median horizontal flow on the right than left, consistent with an expansion component. Common drift and vegetation/people/turning prevent a recovered camera-direction claim. No source geometry/GPU/Safari pass is inferred.

Diagnostic uses SciPy/NumPy/Pillow already available, not the unavailable cv2. Two synthetic translations recover their exact integer screen shifts; this validates patch bookkeeping only. Full source hashes, heading hashes, point coordinates, NCC scores and local requested times are retained. Main global time mapping remains inherited, and current live dependency immutability is not established.

No heading correction or gate removal is justified by these samples. Original iPhone blocked-forward FAIL remains unresolved; do not claim this diagnostic reproduces that exact phone pose/state. Independent actual-source translation/junction assessment and real iPhone Safari with exact-player advisor approval remain required.
''')
