"""Serve a static build with automatic page refresh after successful rebuilds."""

import argparse
import io
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


RELOAD_SCRIPT = """<script>
(() => {
  const revision = REVISION;
  async function check() {
    try {
      const response = await fetch('/__dev/revision', { cache: 'no-store' });
      if (response.ok && await response.text() !== revision) {
        location.reload();
        return;
      }
    } catch {
      // Keep checking while the development server is restarting.
    }
    setTimeout(check, 750);
  }
  setTimeout(check, 750);
})();
</script>
"""


class DevHandler(SimpleHTTPRequestHandler):
    def revision(self):
        try:
            return (Path(self.directory) / ".revision").read_text()
        except FileNotFoundError:
            return ""

    def send_content(self, content, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        return io.BytesIO(content)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        if urlsplit(self.path).path == "/__dev/revision":
            return self.send_content(self.revision().encode(), "text/plain; charset=utf-8")

        path = Path(self.translate_path(self.path))
        if path.is_dir() and urlsplit(self.path).path.endswith("/"):
            path = path / "index.html"
        if path.is_file() and path.suffix == ".html":
            script = RELOAD_SCRIPT.replace("REVISION", json.dumps(self.revision())).encode()
            content = path.read_bytes().replace(b"</body>", script + b"</body>")
            return self.send_content(content, "text/html; charset=utf-8")
        return super().send_head()

    def log_request(self, code="-", size="-"):
        if urlsplit(self.path).path != "/__dev/revision":
            super().log_request(code, size)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8390)
    parser.add_argument("--directory", type=Path, default=Path("build"))
    args = parser.parse_args()
    handler = partial(DevHandler, directory=str(args.directory.resolve()))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(
            f"Serving {args.directory} at http://{args.bind}:{server.server_port} (live reload)",
            flush=True,
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
