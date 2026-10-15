# SPDX-License-Identifier: MIT
"""Read the verdict of a test page from the DOM a headless browser saved.

The test pages (runtime.html, legacy/tests/smoke.html) write their verdict to
<pre id="result" data-status="pass|fail">. Prints the report and exits with 0 only
when the status is "pass". Usage: python3 ui/tests/result.py saved-page.html
"""

import html
import re
import sys

page = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'<pre id="result" data-status="(\w+)"[^>]*>(.*?)</pre>', page, re.S)
if not match:
    sys.exit("The test page did not report a result.")
print(html.unescape(match.group(2)))
sys.exit(0 if match.group(1) == "pass" else 1)
