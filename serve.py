"""Static server for the Pacific site with caching disabled, so module
edits always show up on a plain refresh."""
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DIR = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=DIR)
    ThreadingHTTPServer(("", 8461), handler).serve_forever()
