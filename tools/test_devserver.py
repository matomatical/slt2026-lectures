"""Exercise development uploads through HTTP requests without opening a socket."""

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

import devserver


class UploadStream(io.BytesIO):
    def read(self, size=-1):
        if not 0 <= size <= 1024 * 1024:
            raise AssertionError("Upload reads must be bounded to 1 MiB")
        # Network streams may return less than the requested number of bytes.
        return super().read(min(size, 4096))


class MemoryConnection:
    def __init__(self, request):
        self.request = UploadStream(request)
        self.response = bytearray()

    def makefile(self, *args, **kwargs):
        return self.request

    def sendall(self, data):
        self.response.extend(data)


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.deck = self.root / "1A"
        self.deck.mkdir()
        (self.deck / "slides.md").write_text("## Slide\n")
        patcher = patch.object(devserver, "LECTURES_DIRECTORY", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, filename="plot.png", deck="1A", body=b"image data", headers=None):
        query = urlencode({"deck": deck, "filename": filename})
        request_headers = {
            "Host": "localhost:8390",
            "Origin": "http://localhost:8390",
            "Content-Type": "application/octet-stream",
            "Content-Length": str(len(body)),
            **(headers or {}),
        }
        request = f"POST /__dev/upload?{query} HTTP/1.1\r\n"
        request += "".join(f"{key}: {value}\r\n" for key, value in request_headers.items())
        connection = MemoryConnection(request.encode() + b"\r\n" + body)
        with patch.object(devserver.DevHandler, "log_request"):
            devserver.DevHandler(connection, ("127.0.0.1", 1234), None, directory=str(self.root))
        head, content = bytes(connection.response).split(b"\r\n\r\n", 1)
        return int(head.split()[1]), json.loads(content)

    def test_upload_and_collision_preserve_bytes(self):
        status, result = self.upload(filename="My plot.PNG", body=b"first")
        self.assertEqual(status, 201)
        self.assertEqual(result["markdown"], "![](media/My-plot.png)")
        status, result = self.upload(filename="My plot.PNG", body=b"second")
        self.assertEqual(status, 201)
        self.assertEqual(result["path"], "media/My-plot-2.png")
        self.assertEqual((self.deck / "media/My-plot.png").read_bytes(), b"first")
        self.assertEqual((self.deck / result["path"]).read_bytes(), b"second")
        self.assertEqual(list(self.deck.glob(".upload-*")), [])

    def test_filename_cannot_escape_media(self):
        status, result = self.upload(filename="../../outside.png")
        self.assertEqual(status, 201)
        self.assertEqual(result["path"], "media/outside.png")
        self.assertFalse((self.root / "outside.png").exists())

    def test_video_formats_produce_controls_markup(self):
        for extension in ("MP4", "webm", "ogv", "mov", "m4v"):
            with self.subTest(extension=extension):
                status, result = self.upload(filename=f"My clip.{extension}")
                self.assertEqual(status, 201)
                path = f"media/My-clip.{extension.lower()}"
                self.assertEqual(result["path"], path)
                self.assertEqual(
                    result["markdown"], f'<video controls src="{path}"></video>'
                )

    def test_large_video_streams_without_overwriting(self):
        body = b"a" * (1024 * 1024 + 17)
        status, result = self.upload(filename="clip.mp4", body=body)
        self.assertEqual(status, 201)
        self.assertEqual((self.deck / result["path"]).read_bytes(), body)
        status, result = self.upload(filename="clip.mp4", body=b"second")
        self.assertEqual(status, 201)
        self.assertEqual(result["path"], "media/clip-2.mp4")
        self.assertEqual((self.deck / "media/clip.mp4").read_bytes(), body)

    def test_video_has_a_larger_limit_than_images(self):
        with (
            patch.object(devserver, "MAX_IMAGE_UPLOAD_BYTES", 4),
            patch.object(devserver, "MAX_VIDEO_UPLOAD_BYTES", 8),
        ):
            self.assertEqual(self.upload(filename="plot.png", body=b"123456")[0], 413)
            self.assertEqual(self.upload(filename="clip.mp4", body=b"123456")[0], 201)
            self.assertEqual(self.upload(filename="clip.mp4", body=b"123456789")[0], 413)

    def test_incomplete_video_is_not_published(self):
        status, _ = self.upload(filename="clip.mp4", headers={"Content-Length": "100"})
        self.assertEqual(status, 400)
        self.assertEqual(list((self.deck / "media").iterdir()), [])
        self.assertEqual(list(self.deck.glob(".upload-*")), [])

    def test_reject_invalid_decks(self):
        for deck, expected in [("../1A", 400), ("unknown", 404)]:
            with self.subTest(deck=deck):
                self.assertEqual(self.upload(deck=deck)[0], expected)
        self.assertFalse((self.deck / "media").exists())

    def test_reject_symlink_escape(self):
        (self.deck / "media").symlink_to(self.root, target_is_directory=True)
        self.assertEqual(self.upload()[0], 404)
        self.assertFalse((self.root / "plot.png").exists())

    def test_existing_symlink_is_not_followed(self):
        (self.deck / "media").mkdir()
        target = self.root / "original.png"
        target.write_bytes(b"original")
        (self.deck / "media/plot.png").symlink_to(target)
        status, result = self.upload()
        self.assertEqual(status, 201)
        self.assertEqual(result["path"], "media/plot-2.png")
        self.assertEqual(target.read_bytes(), b"original")

    def test_reject_cross_origin_and_form_uploads(self):
        for headers in [
            {"Origin": "https://example.com"},
            {"Sec-Fetch-Site": "cross-site"},
            {"Content-Type": "multipart/form-data"},
        ]:
            with self.subTest(headers=headers):
                self.assertIn(self.upload(headers=headers)[0], (403, 415))
        self.assertFalse((self.deck / "media").exists())

    def test_reject_unsupported_empty_large_and_incomplete_uploads(self):
        self.assertEqual(self.upload(filename="file.html")[0], 415)
        self.assertEqual(self.upload(body=b"")[0], 413)
        self.assertEqual(self.upload(headers={"Content-Length": "invalid"})[0], 413)
        self.assertEqual(self.upload(headers={"Content-Length": str(26 * 1024 * 1024)})[0], 413)
        self.assertEqual(self.upload(headers={"Content-Length": "100"})[0], 400)
        self.assertEqual(list((self.deck / "media").iterdir()), [])
        self.assertEqual(list(self.deck.glob(".upload-*")), [])


if __name__ == "__main__":
    unittest.main()
