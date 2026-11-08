"""Builds the three themed editions of "Alexander Kim Portfolio" as PDFs.

    python3 build_themes.py               # all three
    python3 build_themes.py bloom veil    # just these

Each theme is an HTML page in themes/ (bloom.html, veil.html, stage.html) that lays out every
project from themes/content.js and draws its generative art in the browser. This script serves
the Alex folder on localhost (so the canvases can read the photos) and has headless
Google Chrome print each page to a 13.333 x 7.5 in PDF, the same size as the original deck.

Edit the words in themes/content.js; all three PDFs pick them up.
"""
import functools
import http.server
import os
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
THEMES = {
    "bloom": "Alexander-Kim-Portfolio-Bloom.pdf",
    "veil": "Alexander-Kim-Portfolio-Veil.pdf",
    "stage": "Alexander-Kim-Portfolio-Opening-Night.pdf",
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    picked = [t for t in sys.argv[1:] if t in THEMES] or list(THEMES)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.dirname(HERE)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    try:
        for theme in picked:
            out = os.path.join(HERE, THEMES[theme])
            subprocess.run([
                CHROME, "--headless=new", "--use-angle=metal", "--hide-scrollbars",
                "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
                "--virtual-time-budget=90000", f"--print-to-pdf={out}",
                f"http://127.0.0.1:{port}/portfolio-slides/themes/{theme}.html",
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
            print("saved", out, f"({os.path.getsize(out) / 1e6:.1f} MB)")
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
