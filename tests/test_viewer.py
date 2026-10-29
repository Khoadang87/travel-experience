"""Browser regressions. Run: python3 -m unittest discover -s tests -v
Requires Python playwright and an installed Chromium (CHROMIUM_PATH overrides path).
"""
import functools
import http.server
import os
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

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
        self.page.wait_for_function('__test.state().w === 2560 && __test.state().paused', timeout=15000)
        self.page.wait_for_timeout(6500)  # catches the former unconditional six-second reverse timer
        self.assertLess(self.page.evaluate('__test.state().pos'), .2)
        self.assertTrue(self.page.locator('#quality').is_visible())
        self.assertIn('2560px', self.page.locator('#quality').inner_text())
        self.assertFalse(any('/r1600/' in r or 'ambience.m4a' in r for r in self.requests))

    def test_save_data_caps_stream_and_manual_quality_can_override(self):
        self.page.add_init_script("Object.defineProperty(navigator, 'connection', {value: {saveData:true, downlink:1}})")
        self.load()
        self.assertEqual(self.page.evaluate('__test.state().w'), 960)
        self.assertIn('Data saver', self.page.locator('#quality').inner_text())
        self.page.wait_for_timeout(1000)
        self.assertFalse(any('/hls/f/s' in r for r in self.requests))
        self.page.locator('#quality').click()  # Auto
        self.page.locator('#quality').click()  # High
        self.page.wait_for_function('__test.state().w === 2560', timeout=15000)
        self.assertIn('High', self.page.locator('#quality').inner_text())
        self.page.locator('#quality').click()  # Data saver
        self.page.wait_for_function('__test.state().w === 960', timeout=15000)

    def test_forward_backward_and_visible_buffer_feedback(self):
        self.load('?t=12')
        self.assertFalse(any('/f960/s000.m4s' in r for r in self.requests))
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
