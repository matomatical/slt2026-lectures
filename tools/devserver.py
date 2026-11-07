"""Serve a static build with automatic page refresh after successful rebuilds."""

import argparse
import io
import json
import os
import re
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


LECTURES_DIRECTORY = Path(__file__).resolve().parent.parent / "lectures"
MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 1024 * 1024
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".mov", ".m4v"}


RELOAD_SCRIPT = """<script>
(() => {
  const revision = REVISION;
  let uploading = false;
  async function check() {
    try {
      const response = await fetch('/__dev/revision', { cache: 'no-store' });
      if (response.ok && await response.text() !== revision && !uploading) {
        location.reload();
        return;
      }
    } catch {
      // Keep checking while the development server is restarting.
    }
    setTimeout(check, 750);
  }
  setTimeout(check, 750);

  if (!document.querySelector('.reveal .slides')) return;
  const deck = location.pathname.split('/').filter(Boolean)[0];
  if (!deck) return;
  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Media uploads');
  panel.setAttribute('aria-live', 'polite');
  panel.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:10000;' +
    'max-width:min(520px,85vw);max-height:65vh;overflow:auto;padding:18px;' +
    'background:#222;color:white;border:1px solid #999;border-radius:8px;' +
    'font:16px/1.4 sans-serif;box-shadow:0 4px 24px #0008;display:none';
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.style.float = 'right';
  const heading = document.createElement('strong');
  heading.textContent = 'Drop images or videos to save in media/';
  const results = document.createElement('div');
  panel.append(close, heading, results);
  document.body.append(panel);
  panel.addEventListener('keydown', event => event.stopPropagation());
  const storageKey = 'dev-image-uploads:' + deck;
  let saved = [];
  try {
    const previous = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
    if (Array.isArray(previous)) saved = previous.filter(item => typeof item === 'string');
  } catch {}
  function remember() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
  }
  function showResult(markdown) {
    const row = document.createElement('p');
    const source = document.createElement('textarea');
    source.value = markdown;
    source.readOnly = true;
    source.rows = 2;
    source.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:8px 0';
    source.addEventListener('focus', () => source.select());
    const copy = document.createElement('button');
    copy.textContent = 'Copy snippet';
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(markdown);
        copy.textContent = 'Copied';
      } catch {
        source.focus();
        source.select();
        copy.textContent = 'Selected — press Ctrl+C / Cmd+C';
      }
    };
    row.append(source, copy);
    results.append(row);
    panel.style.display = 'block';
  }
  saved.forEach(showResult);
  close.onclick = () => {
    if (uploading) return;
    saved = [];
    remember();
    results.replaceChildren();
    panel.style.display = 'none';
  };
  document.addEventListener('dragover', event => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', async event => {
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    event.preventDefault();
    if (uploading) return;
    uploading = true;
    close.disabled = true;
    panel.style.display = 'block';
    heading.textContent = 'Saving media…';
    try {
      for (const file of files) {
        heading.textContent = 'Saving ' + file.name + '…';
        try {
          const query = new URLSearchParams({ deck, filename: file.name });
          const response = await fetch('/__dev/upload?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          saved.push(result.markdown);
          remember();
          showResult(result.markdown);
        } catch (error) {
          const message = document.createElement('p');
          message.textContent = file.name + ': ' + error.message;
          results.append(message);
        }
      }
    } finally {
      heading.textContent = 'Media uploads — use in your Markdown';
      uploading = false;
      close.disabled = false;
    }
  });
})();
</script>
"""


class DevHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, value):
        content = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        self.close_connection = True
        request = urlsplit(self.path)
        if request.path != "/__dev/upload":
            self.send_json(404, {"error": "Unknown upload endpoint"})
            return
        # Allow the deck's own fetch requests, including on tailnet HTTP origins.
        origin = self.headers.get("Origin")
        if (
            origin and origin != f"http://{self.headers.get('Host')}"
            and origin != f"https://{self.headers.get('Host')}"
        ) or self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.send_json(403, {"error": "Upload from the deck's own origin"})
            return
        if self.headers.get_content_type() != "application/octet-stream":
            self.send_json(415, {"error": "Expected a binary media upload"})
            return
        query = parse_qs(request.query)
        deck = query.get("deck", [""])[0]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", deck):
            self.send_json(400, {"error": "Invalid deck name"})
            return
        deck_directory = (LECTURES_DIRECTORY / deck).resolve()
        media_directory = (deck_directory / "media").resolve()
        if (
            deck_directory.parent != LECTURES_DIRECTORY.resolve()
            or media_directory.parent != deck_directory
            or not (deck_directory / "slides.md").is_file()
        ):
            self.send_json(404, {"error": "Unknown deck or invalid media directory"})
            return
        filename = query.get("filename", [""])[0].replace("\\", "/").rsplit("/", 1)[-1]
        extension = Path(filename).suffix.lower()
        if extension not in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS:
            self.send_json(415, {"error": "Choose an image or an MP4, WebM, OGV, MOV or M4V video"})
            return
        is_video = extension in VIDEO_EXTENSIONS
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(filename).stem).strip("-_")[:100] or "image"
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        limit = MAX_VIDEO_UPLOAD_BYTES if is_video else MAX_IMAGE_UPLOAD_BYTES
        if not 0 < length <= limit:
            self.send_json(413, {
                "error": f"Files must be nonempty and at most {limit // (1024 * 1024)} MiB"
            })
            return
        try:
            media_directory.mkdir(exist_ok=True)
            # Publish a complete file atomically, without replacing existing assets.
            with tempfile.NamedTemporaryFile(dir=deck_directory, prefix=".upload-") as media:
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(remaining, UPLOAD_CHUNK_BYTES))
                    if not chunk:
                        self.send_json(400, {"error": "Incomplete upload"})
                        return
                    media.write(chunk)
                    remaining -= len(chunk)
                media.flush()
                suffix = 1
                while True:
                    name = f"{stem}{'' if suffix == 1 else f'-{suffix}'}{extension}"
                    try:
                        os.link(media.name, media_directory / name)
                        break
                    except FileExistsError:
                        suffix += 1
        except OSError:
            self.send_json(500, {"error": "Could not save the file in the deck's media directory"})
            return
        path = f"media/{name}"
        markdown = (
            f'<video controls src="{path}"></video>'
            if is_video else f"![]({path})"
        )
        self.send_json(201, {"path": path, "markdown": markdown})

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
