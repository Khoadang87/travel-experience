"""Browser regressions. Run: python3 -m unittest discover -s tests -v
Requires Python playwright and an installed Chromium (CHROMIUM_PATH overrides path).
"""
import functools
import http.server
import os
import re
import json
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WIDTHS = [int(w) for w in re.findall(r'RESOLUTION=(\d+)x', (ROOT / 'cities/hoian/assets/walk/hls/f.m3u8').read_text())]
LOW, HIGH = min(WIDTHS), max(WIDTHS)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass  # browsers intentionally cancel media requests after a seek or close

class ViewerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width':1280, 'height':720})
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('request', lambda r: self.requests.append(r.url))

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def load(self, query=''):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/cities/hoian/{query}', wait_until='domcontentloaded')
        self.page.wait_for_function('window.__state.loaded && __test.state().frames > 0', timeout=25000)

    def test_paused_first_frame_sharpens_without_reverse_or_audio_download(self):
        self.load()
        self.page.wait_for_function(f'__test.state().w === {HIGH} && __test.state().paused', timeout=15000)
        self.page.wait_for_timeout(6500)  # catches the former unconditional six-second reverse timer
        self.assertLess(self.page.evaluate('__test.state().pos'), .2)
        self.assertTrue(self.page.locator('#quality').is_visible())
        self.assertIn(f'{HIGH}px', self.page.locator('#quality').inner_text())
        self.assertFalse(any('/r1600/' in r or 'ambience.m4a' in r for r in self.requests))

    def test_save_data_caps_stream_and_manual_quality_can_override(self):
        self.page.add_init_script("Object.defineProperty(navigator, 'connection', {value: {saveData:true, downlink:1}})")
        self.load()
        self.assertEqual(self.page.evaluate('__test.state().w'), LOW)
        self.assertIn('Data saver', self.page.locator('#quality').inner_text())
        self.page.wait_for_timeout(1000)
        self.assertFalse(any(f'/hls/f{HIGH}/s' in r for r in self.requests))
        self.page.locator('#quality').click()  # Auto
        self.page.locator('#quality').click()  # High
        self.page.wait_for_function(f'__test.state().w === {HIGH}', timeout=15000)
        self.assertIn('High', self.page.locator('#quality').inner_text())
        self.page.locator('#quality').click()  # Data saver
        self.page.wait_for_function(f'__test.state().w === {LOW}', timeout=15000)

    def test_forward_backward_and_visible_buffer_feedback(self):
        self.load('?t=12')
        self.assertFalse(any(f'/f{LOW}/s000.m4s' in r for r in self.requests))
        self.page.keyboard.down('w')
        self.page.wait_for_function('__test.state().pos > 13', timeout=15000)
        visible = self.page.evaluate('''() => {
            const v = [...document.querySelectorAll('video')].find(v => !v.paused);
            v.dispatchEvent(new Event('waiting'));
            const shown = !document.getElementById('spin').hidden && getComputedStyle(document.getElementById('spin')).display !== 'none';
            v.dispatchEvent(new Event('playing'));
            return shown && document.getElementById('spin').hidden;
        }''')
        self.assertTrue(visible)
        self.page.keyboard.up('w')
        self.page.wait_for_function('__test.state().paused', timeout=10000)
        before = self.page.evaluate('__test.state().pos')
        self.page.keyboard.down('s')
        self.page.wait_for_function('__test.state().dir === "rev" && !__test.state().swapping', timeout=25000)
        self.page.wait_for_function('(before) => __test.state().pos < before - .2', arg=before, timeout=10000)
        self.page.keyboard.up('s')
        self.page.wait_for_function('__test.state().paused', timeout=10000)
        self.assertTrue(any('/r1600/' in r for r in self.requests))
        self.assertFalse(any('/r1600/s000.m4s' in r for r in self.requests))

    def native_playlist(self, mode, width):
        # Exercise playlist routing; Chromium emulation does not validate Safari decoding.
        self.page.add_init_script("""Object.defineProperty(navigator, 'userAgent', {value:'Version/18.0 Safari/605.1.15'});
            const original = HTMLMediaElement.prototype.canPlayType;
            HTMLMediaElement.prototype.canPlayType = function(type) {
                return type === 'application/vnd.apple.mpegurl' ? 'maybe' : original.call(this, type);
            };""")
        with self.page.expect_request(f'**/hls/f{width}/index.m3u8'):
            self.page.goto(f'http://127.0.0.1:{self.server.server_port}/cities/hoian/?quality={mode}', wait_until='domcontentloaded')

    def test_native_high_selects_high_playlist(self):
        self.native_playlist('high', HIGH)

    def test_native_data_saver_selects_low_playlist(self):
        self.native_playlist('low', LOW)

    def test_explore_pauses_walk_seeks_and_restores_controls(self):
        self.load('?t=10')
        self.page.keyboard.down('w')
        self.page.wait_for_function('__test.state().pos > 10.5', timeout=10000)
        self.page.locator('#explore-toggle').click()
        self.page.keyboard.up('w')
        self.assertTrue(self.page.locator('#explore').is_visible())
        self.assertTrue(self.page.evaluate('__test.state().paused'))
        self.page.locator('#route-position').fill('120')
        self.page.locator('#route-go').click()
        self.page.wait_for_function('document.getElementById("explore").hidden', timeout=25000)
        self.assertAlmostEqual(self.page.evaluate('__test.state().pos'), 120, delta=.2)
        self.page.keyboard.down('w')
        self.page.wait_for_function('__test.state().pos > 120.5', timeout=10000)
        self.page.keyboard.up('w')

    def test_explore_keyboard_and_unavailable_interiors(self):
        self.load()
        self.page.locator('#explore-toggle').click()
        self.assertTrue(self.page.locator('#no-connections').is_visible())
        self.assertEqual(self.page.locator('#route-connections a').count(), 0)
        self.page.locator('#route-position').focus()
        before = self.page.evaluate('__test.state().pos')
        self.page.keyboard.press('ArrowRight')
        self.assertAlmostEqual(self.page.evaluate('__test.state().pos'), before, delta=.1)
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#explore').is_hidden())
        self.assertTrue(self.page.locator('#explore-toggle').evaluate('(el) => document.activeElement === el'))

    def test_connected_route_preserves_quality_and_entry_position(self):
        fixture = {'defaultRoute':'old-town', 'routes':[
            {'id':'old-town', 'name':'Test street', 'kind':'street', 'manifest':'assets/walk/walk.json', 'duration':660, 'connections':[{'route':'test-room','at':30,'entry':20,'label':'Test entrance'}]},
            {'id':'test-room', 'name':'Test interior fixture', 'kind':'interior', 'manifest':'assets/walk/walk.json', 'duration':660, 'connections':[]}
        ]}
        self.page.route('**/routes.json', lambda route: route.fulfill(json=fixture))
        self.load('?quality=high')
        self.page.locator('#explore-toggle').click()
        link = self.page.locator('#route-connections a')
        self.assertIn('quality=high', link.get_attribute('href'))
        self.assertIn('route=test-room', link.get_attribute('href'))
        with self.page.expect_navigation(wait_until='domcontentloaded'):
            link.click()
        self.page.wait_for_function('window.__state?.loaded && Math.abs(__test.state().pos - 20) < .3', timeout=25000)
        self.page.locator('#explore-toggle').click()
        self.assertEqual(self.page.locator('#route-name').inner_text(), 'Test interior fixture')

    def test_turn_prompt_only_appears_at_connected_junction(self):
        fixture = {'defaultRoute':'old-town', 'routes':[
            {'id':'old-town','name':'Test street','manifest':'assets/walk/walk.json','duration':660,'connections':[{'route':'side-street','at':30,'radius':4,'entry':12,'label':'Turn into side street'}]},
            {'id':'side-street','name':'Side street fixture','manifest':'assets/walk/walk.json','duration':660,'connections':[]}
        ]}
        self.page.route('**/routes.json', lambda route: route.fulfill(json=fixture))
        self.load('?t=30&quality=low')
        self.page.locator('#quality').click()  # Auto
        self.page.locator('#quality').click()  # High, chosen after initial URL
        self.page.wait_for_function('!document.getElementById("junctions").hidden')
        link = self.page.locator('#junctions a')
        self.assertEqual(link.inner_text(), 'Turn into side street')
        self.page.wait_for_function('document.querySelector("#junctions a").href.includes("quality=high")')
        self.assertIn('quality=high', link.get_attribute('href'))
        self.page.locator('#explore-toggle').click()
        self.assertTrue(self.page.locator('#junctions').is_hidden())
        self.page.locator('#route-position').fill('60')
        self.page.locator('#route-go').click()
        self.page.wait_for_function('document.getElementById("explore").hidden && document.getElementById("junctions").hidden', timeout=25000)
        self.page.evaluate('HoianWalk.goTo(30)')
        self.page.wait_for_function('!document.getElementById("junctions").hidden')
        with self.page.expect_navigation(wait_until='domcontentloaded'):
            self.page.locator('#junctions a').click()
        self.page.wait_for_function('window.__state?.loaded && Math.abs(__test.state().pos - 12) < .3', timeout=25000)
        self.assertIn('route=side-street', self.page.url)

    def test_unknown_route_reports_error(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/cities/hoian/?route=missing', wait_until='domcontentloaded')
        self.page.wait_for_function('!!window.__viewerError', timeout=10000)
        self.assertIn('not available', self.page.locator('#error').inner_text())

    def test_manifest_failure_is_reported(self):
        self.page.route('**/hls/f.m3u8', lambda route: route.fulfill(status=404, body='missing'))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/cities/hoian/', wait_until='domcontentloaded')
        self.page.wait_for_function('!!window.__viewerError', timeout=25000)
        self.assertTrue(self.page.locator('#error').is_visible())
        self.assertTrue(self.page.locator('#loader').is_hidden())
        self.assertFalse(self.page.evaluate('window.__state.loaded'))

    def test_decoding_failure_after_start_is_reported(self):
        self.load()
        self.page.evaluate('document.querySelector("video").dispatchEvent(new Event("error"))')
        self.assertTrue(self.page.locator('#error').is_visible())
        self.assertTrue(self.page.locator('#spin').is_hidden())
        self.assertIn('decoded', self.page.locator('#error').inner_text())

if __name__ == '__main__':
    unittest.main()
