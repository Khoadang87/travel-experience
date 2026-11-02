"""Estimate local panorama travel bearings, not route continuity or acceptance.

Usage: python measure-return-heading-w53.py INPUT_MP4 OUTPUT_JSON [HEADING_JSON]
Source times in this file are local to the 695..730 second extraction.
"""
import hashlib
import json
import math
import statistics
import sys
from pathlib import Path

import cv2
import numpy as np

W, H = 768, 512
F = H / (2 * math.tan(math.radians(70) / 2))
K = np.array([[F, 0, W / 2], [0, F, H / 2], [0, 0, 1]], dtype=float)
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
vx, vy = (x - W / 2) / F, -(y - H / 2) / F
# u=.5 perspective view: this is a source-image bearing, not world north.
xx, zz = -np.ones_like(x), -vx
u = (np.arctan2(zz, xx) / (2 * np.pi)) % 1
v = .5 - np.arcsin(vy / np.sqrt(vx * vx + vy * vy + 1)) / np.pi
mask = np.zeros((H, W), dtype=np.uint8)
mask[100:305, :300] = 255
mask[100:305, 468:] = 255


def features(panorama):
    perspective = cv2.remap(panorama, (u * panorama.shape[1]).astype(np.float32),
                            (v * panorama.shape[0]).astype(np.float32), cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_WRAP)
    return cv2.SIFT_create(nfeatures=3500).detectAndCompute(perspective, mask)


def estimate(first, second):
    ka, da = first
    kb, db = second
    if da is None or db is None:
        return {'usable': False, 'reason': 'No descriptors'}
    pairs = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [a for pair in pairs if len(pair) == 2 for a, b in [pair] if a.distance < .72 * b.distance]
    if len(good) < 12:
        return {'usable': False, 'matches': len(good)}
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    matrix, inliers = cv2.findEssentialMat(pa, pb, K, method=cv2.RANSAC, prob=.999, threshold=1)
    if matrix is None:
        return {'usable': False, 'matches': len(good)}
    n, rotation, translation, _ = cv2.recoverPose(matrix[:3], pa, pb, K, mask=inliers.copy())
    angle = math.degrees(math.acos(float(np.clip((np.trace(rotation) - 1) / 2, -1, 1))))
    displacement = float(np.median(np.linalg.norm(pb - pa, axis=1)))
    tx, ty, tz = translation.ravel()
    usable = bool(n >= 25 and n / len(good) > .35 and displacement > 1 and angle < 15 and tz < -.5 and abs(ty) < .5)
    # recoverPose translation points opposite camera motion. In the reprojected
    # view, image x increases panorama u, while Three.js yaw increases the other
    # way. This is a per-pair estimate in the SECOND frame's camera coordinates.
    yaw = math.pi / 2 + math.atan2(float(tx), float(-tz)) if usable else None
    return {'usable': usable, 'matches': len(good), 'cheirality_inliers': n,
            'rotation_degrees': round(angle, 3), 'median_pixel_displacement': round(displacement, 3),
            'translation_camera2_from_camera1': translation.ravel().tolist(), 'travel_yaw_second_frame': yaw}


def main(source, output, heading_output=None):
    capture = cv2.VideoCapture(str(source))
    fps = capture.get(cv2.CAP_PROP_FPS)
    frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    if fps <= 0 or frame_count / fps < 34.8:
        raise ValueError('The complete 35 second source is required')
    results, first = [], None
    for second in range(35):
        capture.set(cv2.CAP_PROP_POS_FRAMES, round(second * fps))
        ok, panorama = capture.read()
        if not ok:
            raise ValueError('Source frame did not decode at ' + str(second))
        current = features(panorama)
        if first is not None:
            results.append({'local_seconds': [second - 1, second], **estimate(first, current)})
        first = current
    capture.release()
    report = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'source_origin_seconds': 695,
              'method': 'u=.5 perspective, upper-facade SIFT, essential RANSAC, cheirality',
              'results': results, 'rendered_picture_checked': False,
              'independent_advisor_approved': False, 'iphone_safari_checked': False,
              'limits': ['Moving objects may contaminate estimates',
                         'No metric or geographic join is established',
                         'Direction inferences require consecutive rendered-picture inspection']}
    output.write_text(json.dumps(report, indent=2) + '\n')
    if heading_output is not None:
        if not all(item['usable'] for item in results):
            raise ValueError('Do not fill missing direction estimates automatically')
        raw = [item['travel_yaw_second_frame'] for item in results]
        smoothed = [statistics.median(raw[max(0, i - 1):min(len(raw), i + 2)]) for i in range(len(raw))]
        track = {'dt': 1, 'h': [math.pi / 2 - smoothed[0]] + [math.pi / 2 - yaw for yaw in smoothed],
                 'origin_source_seconds': 695, 'kind': 'estimated_two_view_geometry',
                 'filter': 'three-pair centered median; first sample extends to local0, route begins at5',
                 'measurements_source_sha256': report['source_sha256'], 'rendered_direction_accepted': False}
        heading_output.write_text(json.dumps(track, indent=2) + '\n')
    print(json.dumps({'pairs': len(results), 'usable': sum(r['usable'] for r in results),
                      'unusable_times': [r['local_seconds'] for r in results if not r['usable']]}))


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) > 3 else None)
