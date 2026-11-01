"""Read-only coverage audit. Does not certify visual quality or physical connectivity."""
import argparse
import hashlib
import json
from pathlib import Path


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def audit(routes_text, player_text):
    config = json.loads(routes_text)
    routes = config.get('routes', [])
    edges, clips, findings = [], [], []
    for route in routes:
        ids = {c['id'] for c in route.get('clips', [])}
        for c in route.get('clips', []):
            clips.append({'route': route['id'], 'clip': c['id'], 'lo': c['lo'], 'hi': c['hi'],
                          'timeline_span_seconds': round(c['hi']-c['lo'], 3),
                          'physical_distance_verified': False, 'return_coverage_verified': False})
        for j in route.get('junctions', []):
            edges.append({'id': j['id'], 'from': [j.get('clip'), j.get('at')],
                          'to': [j.get('toClip'), j.get('toTime')],
                          'known_clip_ids': j.get('clip') in ids and j.get('toClip') in ids,
                          'physical_continuity': 'unreviewed', 'eligible_for_free_roam': False})
        if route.get('mockJunctions'):
            findings.append({'code': 'mock_edges', 'detail': 'Mock/test links exist in configuration and are not evidence of connected streets.'})
        if 'forward or back' in route.get('description', ''):
            findings.append({'code': 'description_overclaims', 'detail': 'Route description promises forward/back movement, which the player source does not establish.'})
    seek_back = "before - 5" in player_text and "async function stepBack" in player_text
    turn_side = 'joyTurn()' in player_text and 'look.yaw += tr' in player_text
    if seek_back:
        findings.append({'code': 'seek_is_not_backward_motion', 'detail': 'Player implements pull-back as an earlier five-second seek, not continuous spatial retreat.'})
    if turn_side:
        findings.append({'code': 'turn_is_not_strafe', 'detail': 'Side stick changes view yaw; it does not establish captured sideways translation.'})
    if 'function buildPath()' in player_text and 'Math.sin(h)' in player_text:
        findings.append({'code': 'map_not_surveyed', 'detail': 'Drawn route integrates heading samples; no verified geographic coordinates or metric scale were found by this audit.'})
    return {'schema': 1, 'routes_sha256': sha(routes_text), 'player_sha256': sha(player_text),
            'clips': clips, 'junctions': edges, 'findings': findings,
            'verified_spatial_connections': 0,
            'delivery_approved': False,
            'missing_evidence': ['independent current-candidate review', 'rendered movement in all promised directions',
                                 'physical continuity of junctions', 'real iPhone Safari acceptance',
                                 'expanded-area coverage for the promised exploration duration'],
            'scope': 'Static source audit only; not a rendered-picture, map-accuracy or phone test.'}


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('routes');p.add_argument('player');args=p.parse_args()
    print(json.dumps(audit(Path(args.routes).read_text(),Path(args.player).read_text()),indent=2,ensure_ascii=False))
