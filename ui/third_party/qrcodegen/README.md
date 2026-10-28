# QR Code generator library

[Project Nayuki's QR Code generator](https://www.nayuki.io/page/qr-code-generator-library), MIT License: the set-up scene draws the set-up code as a QR code with it (`src/scenes/setup.js`).

- **Source:** `typescript-javascript/qrcodegen.ts` of [nayuki/QR-Code-generator](https://github.com/nayuki/QR-Code-generator), commit `3c6d0b3cefb4e049dc337e82237c9644399716a8` (2026-08-31). SHA-256 of that file: `1dc03fb5a10e0e2318ea162755bbdb9977ca6ce52cff959e9c9b6deafdccda9c`.
- **Built** as upstream's `build.sh` does, with TypeScript 5.6.3:
  ```sh
  npx -p typescript@5.6.3 tsc --strict --lib DOM,DOM.Iterable,ES6 --target ES6 qrcodegen.ts
  ```
- **One change:** a last line, `export default qrcodegen;`, makes the namespace an ES module, as the renderer's modules are.

To update it, build a newer commit the same way, then update this file.
