import json
import unittest
from coverage_audit import audit

class CoverageAuditTests(unittest.TestCase):
    def data(self, **extra):
        r={'id':'walk','clips':[{'id':'main','lo':0,'hi':10},{'id':'river','lo':12,'hi':20}],
           'junctions':[{'id':'turn','clip':'main','at':4,'toClip':'river','toTime':12}]}
        r.update(extra);return json.dumps({'routes':[r]})
    def test_timestamps_and_valid_ids_do_not_prove_physical_connection(self):
        r=audit(self.data(),'')
        self.assertTrue(r['junctions'][0]['known_clip_ids'])
        self.assertFalse(r['junctions'][0]['eligible_for_free_roam'])
        self.assertEqual(r['verified_spatial_connections'],0)
    def test_seek_and_yaw_cannot_pass_as_backward_and_sideways_motion(self):
        r=audit(self.data(),'async function stepBack before - 5 joyTurn() look.yaw += tr')
        self.assertTrue({'seek_is_not_backward_motion','turn_is_not_strafe'} <= {f['code'] for f in r['findings']})
        self.assertFalse(r['delivery_approved'])
    def test_mock_links_and_marketing_text_are_not_evidence(self):
        r=audit(self.data(description='walk forward or back',mockJunctions=[{'id':'fake'}]),'')
        self.assertEqual(len(r['findings']),2);self.assertFalse(r['delivery_approved'])
    def test_snapshot_changes_invalidate_previous_identity(self):
        first=audit(self.data(),'v1');changed=audit(self.data(),'v2')
        self.assertNotEqual(first['player_sha256'],changed['player_sha256'])
    def test_no_inputs_cannot_accidentally_pass(self):
        r=audit('{"routes":[]}','');self.assertFalse(r['delivery_approved'])
        self.assertIn('real iPhone Safari acceptance',r['missing_evidence'])

if __name__=='__main__':unittest.main()
