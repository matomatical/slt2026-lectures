"""Check the column shorthand against Pandoc's actual Markdown parser."""

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def convert(source, output="json"):
    return subprocess.run(
        [
            "pandoc", "--from=markdown", f"--to={output}", "--slide-level=2",
            "--lua-filter=filters/comments-to-notes.lua",
            "--lua-filter=filters/slide-columns.lua",
        ],
        input=source, text=True, capture_output=True, cwd=ROOT,
    )


class ColumnTests(unittest.TestCase):
    def blocks(self, source):
        result = convert(source)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)["blocks"]

    def test_both_layouts_and_slide_boundaries(self):
        for layout in ("sidebar", "split"):
            with self.subTest(layout=layout):
                blocks = self.blocks(
                    f"## Columns {{.{layout}}}\n\nLeft\n\n---\n\nRight\n\n"
                    "## Ordinary\n\nUnchanged\n\n# Section\n"
                )
                self.assertEqual([block["t"] for block in blocks],
                                 ["Header", "Div", "Header", "Para", "Header"])
                wrapper = blocks[1]["c"]
                self.assertEqual(wrapper[0][1], ["columns", layout])
                columns = wrapper[1]
                self.assertEqual(len(columns), 2)
                for column, word in zip(columns, ("Left", "Right")):
                    self.assertEqual(column["c"][0][1], ["column"])
                    self.assertEqual(column["c"][1][0]["c"][0]["c"], word)

    def test_notes_outside_columns(self):
        blocks = self.blocks(
            "## Notes {.sidebar}\n\n* Point <!-- Left note -->\n\n---\n\n"
            "![Image](media/image.png)\n\n<!-- Right note -->\n\n"
            "::: notes\nExplicit note\n:::\n"
        )
        self.assertEqual([block["t"] for block in blocks],
                         ["Header", "Div", "Div", "Div", "Div"])
        for note in blocks[2:]:
            self.assertEqual(note["c"][0][1], ["notes"])

    def test_nested_rule_and_subheading_stay_in_column(self):
        blocks = self.blocks(
            "## Nested {.split}\n\n### Subheading\n\n"
            "::: example\nBefore\n\n---\n\nAfter\n:::\n\n---\n\n* Right\n"
        )
        left, right = blocks[1]["c"][1]
        self.assertEqual([block["t"] for block in left["c"][1]], ["Header", "Div"])
        self.assertEqual(right["c"][1][0]["t"], "BulletList")
        self.assertIn("HorizontalRule", json.dumps(left))

    def test_unmarked_rule_still_splits_slides(self):
        result = convert("## Ordinary\n\nBefore\n\n---\n\nAfter\n", "revealjs")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count("<section"), 2)

    def test_column_rule_does_not_create_extra_slide(self):
        result = convert("## Columns {.split}\n\nLeft\n\n---\n\nRight\n", "revealjs")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count("<section"), 1)
        self.assertIn('class="columns split"', result.stdout)

    def test_invalid_layouts_have_clear_errors(self):
        cases = [
            ("## Missing {.split}\n\nText\n", "add a --- divider"),
            ("## Many {.sidebar}\n\nA\n\n---\n\nB\n\n---\n\nC\n",
             "exactly one ---"),
            ("## Both {.sidebar .split}\n\nA\n\n---\n\nB\n",
             "choose .sidebar or .split"),
        ]
        for source, message in cases:
            with self.subTest(message=message):
                result = convert(source)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)


if __name__ == "__main__":
    unittest.main()
