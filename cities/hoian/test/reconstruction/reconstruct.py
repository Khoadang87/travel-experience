from pathlib import Path
import json, time
import pycolmap as pc

root = Path(__file__).parent
db = root / 'features.db'
out = root / 'sparse'
out.mkdir(exist_ok=True)
started = time.time()
extract = pc.FeatureExtractionOptions()
extract.num_threads = 4
extract.max_image_size = 800
extract.sift.max_num_features = 4000
reader = pc.ImageReaderOptions()
reader.camera_model = 'PINHOLE'
reader.camera_params = '400,400,400,400'
pc.extract_features(db, root / 'images', camera_mode=pc.CameraMode.SINGLE,
                    reader_options=reader, extraction_options=extract, device=pc.Device.cpu)
matching = pc.FeatureMatchingOptions()
matching.num_threads = 4
pc.match_exhaustive(db, matching_options=matching, device=pc.Device.cpu)
opts = pc.IncrementalPipelineOptions()
opts.num_threads = 4
opts.ba_refine_focal_length = False
opts.ba_refine_principal_point = False
opts.ba_refine_extra_params = False
opts.max_runtime_seconds = 90
models = pc.incremental_mapping(db, root / 'images', out, options=opts)
results = []
for key, model in models.items():
    results.append({'model': key, 'registered_images': model.num_reg_images(),
                    'points3D': model.num_points3D(), 'mean_reprojection_error': model.compute_mean_reprojection_error()})
    model.export_PLY(str(root / f'sparse-{key}.ply'))
report = {'input_frames': len(list((root / 'images').glob('*.jpg'))),
          'source_seconds': [1102,1122], 'elapsed_seconds': round(time.time()-started,2),
          'models': results, 'scope': 'CPU sparse reconstruction only; no textured mesh, collision or free-navigation acceptance'}
(root / 'results.json').write_text(json.dumps(report, indent=2))
print('RESULT', json.dumps(report), flush=True)
