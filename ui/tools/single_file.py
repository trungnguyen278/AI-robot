# SPDX-License-Identifier: MIT
"""Build a page of ui/ as one HTML file, with every JavaScript module inlined.

The pages load ES modules, which browsers refuse from file:// and which some hosts
refuse as separate files. The single file opens anywhere: from disk, attached to a
message, or as a claude.ai Artifact (with --fragment, which leaves out the document
skeleton such hosts add themselves).

Each module is wrapped in a function that returns its exports, in dependency order.
Modules may only use these forms, one name per statement:
    import { a, b as c } from './x.js';     import x from './x.js';
    export const NAME = …    export function NAME(…)    export class NAME
    export default <an expression, such as an object>
Anything else (export let, export {…}, a generator, destructuring, an import cycle)
stops the build rather than producing a file that behaves differently. CI runs the
renderer's tests on a single-file build of their page, to catch what this cannot.

Usage (Python 3.11 or later, any OS):
    python3 ui/tools/single_file.py [--page index.html] [--fragment] --out studio.html
"""

from __future__ import annotations

import argparse
import posixpath
import re
from pathlib import Path

UI_DIR = Path(__file__).resolve().parents[1]
IMPORT = re.compile(r"^import\s+(\{[^}]*\}|\w+)\s+from\s+'(\.[^']+)';[ \t]*$", re.M)
EXPORT = re.compile(
    r"^export\s+(?:const\s+(\w+)\s*=|(?:async\s+)?function\s+(\w+)\s*\(|class\s+(\w+)\b)", re.M
)
DEFAULT = re.compile(r"^export\s+default\s+(?!function\b|class\b|async\b)", re.M)
SCRIPT = re.compile(r'<script type="module" src="([^"]+)"></script>')


def resolve(importer: str, spec: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(importer), spec))


def modules_in_order(entry: str) -> list[str]:
    """``entry`` and every module it imports, each after the modules it imports."""
    order: list[str] = []
    done: set[str] = set()
    visiting: list[str] = []

    def visit(path: str) -> None:
        if path in done:
            return
        if path in visiting:
            cycle = " -> ".join([*visiting[visiting.index(path) :], path])
            raise SystemExit(f"import cycle: {cycle}")
        visiting.append(path)
        for _, spec in IMPORT.findall((UI_DIR / path).read_text(encoding="utf-8")):
            visit(resolve(path, spec))
        visiting.pop()
        done.add(path)
        order.append(path)

    visit(entry)
    return order


def bundle(entry: str) -> str:
    order = modules_in_order(entry)
    names = {path: f"__module{i}" for i, path in enumerate(order)}
    parts = []
    for path in order:
        code = (UI_DIR / path).read_text(encoding="utf-8")

        def to_const(match: re.Match[str], path: str = path) -> str:
            what, module = match.group(1), names[resolve(path, match.group(2))]
            if what.startswith("{"):
                return f"const {{ {what.strip('{} ').replace(' as ', ': ')} }} = {module};"
            return f"const {what} = {module}.default;"

        code = IMPORT.sub(to_const, code)
        exports = [next(name for name in match if name) for match in EXPORT.findall(code)]
        code = EXPORT.sub(lambda match: match.group(0).removeprefix("export").lstrip(), code)
        if DEFAULT.search(code):
            code = DEFAULT.sub("const __default = ", code)
            exports.append("default: __default")
        if re.search(r"^\s*(import|export)\b", code, re.M):
            raise SystemExit(f"{path}: an import or export this tool does not handle")
        parts.append(
            f"// {path}\nconst {names[path]} = (() => {{\n{code}\n"
            f"return {{ {', '.join(exports)} }};\n}})();"
        )
    return "\n\n".join(parts)


def build(page: str, fragment: bool) -> str:
    html = (UI_DIR / page).read_text(encoding="utf-8")
    match = SCRIPT.search(html)
    if not match:
        raise SystemExit(f'{page}: no <script type="module" src=…>')
    entry = resolve(page, match.group(1))  # the script's path is relative to the page
    html = html.replace(match.group(0), f"<script>\n{bundle(entry)}\n</script>")
    if fragment:
        for pattern in (
            r"<!doctype html>\s*",
            r"</?html[^>]*>\s*",
            r"</?head>\s*",
            r"</?body>\s*",
            r'<meta charset="utf-8">\s*',
            r'<meta name="viewport"[^>]*>\s*',
        ):
            html = re.sub(pattern, "", html)
        # The title first: such hosts look for it near the top of the file.
        title = re.search(r"<title>[^<]*</title>", html)
        if not title:
            raise SystemExit(f"{page}: no <title>")
        html = html.replace(title.group(0), "", 1)
        sides = '<meta name="claude:viewport-fit-sides" content="cover">'
        html = f"{title.group(0)}\n{sides}\n{html.lstrip()}"
    return html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--page", default="index.html", help="page under ui/ (default: index.html)")
    parser.add_argument("--fragment", action="store_true", help="leave out the document skeleton")
    parser.add_argument("--out", required=True, type=Path, help="file to write")
    args = parser.parse_args()
    args.out.write_text(build(args.page, args.fragment), encoding="utf-8")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
