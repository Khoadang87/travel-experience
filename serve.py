#!/usr/bin/env python3
"""Static file server with HTTP Range support (needed for 360 video seeking)."""
from __future__ import annotations

import argparse
import os
import posixpath
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None
        ctype = self.guess_type(path)
        try:
            fs = os.stat(path)
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = fs.st_size
        range_header = self.headers.get("Range")
        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return open(path, "rb")

        # bytes=start-end
        if not range_header.startswith("bytes="):
            self.send_error(416, "Invalid Range")
            return None
        spec = range_header.split("=", 1)[1].split(",")[0].strip()
        start_s, _, end_s = spec.partition("-")
        try:
            if start_s:
                start = int(start_s)
                end = int(end_s) if end_s else size - 1
            else:
                # suffix range: bytes=-N
                suffix = int(end_s)
                start = max(size - suffix, 0)
                end = size - 1
        except ValueError:
            self.send_error(416, "Invalid Range")
            return None
        if start >= size or start < 0 or end < start:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        end = min(end, size - 1)
        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        file = open(path, "rb")
        file.seek(start)
        self._range_length = length
        return file

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_range_length", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            outputfile.write(chunk)
        self._range_length = None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--dir", default=os.getcwd())
    args = parser.parse_args()
    os.chdir(args.dir)
    httpd = ThreadingHTTPServer((args.bind, args.port), RangeRequestHandler)
    print(f"Serving {os.getcwd()} at http://{args.bind}:{args.port}/ (Range enabled)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
