/* Keep SDK 57's CommonJS query-string API while using the patched ESM decoder.
 * The upstream algorithm is unchanged; only its export declaration is adapted via committed pnpm patch.
 * This script performs nonmutating verification of the committed patch and package integrity.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

const directory = path.dirname(require.resolve('decode-uri-component'));
const packagePath = path.join(directory, 'package.json');
const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
assert.equal(metadata.version, '0.5.0', 'Review the decoder bridge before changing versions');

const source = fs.readFileSync(path.join(directory, 'index.js'), 'utf8');
assert.equal(
  createHash('sha256').update(source).digest('hex'),
  '9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa',
  'Decoder source differs from the reviewed 0.5.0 npm package'
);

// Nonmutating verification of patched CommonJS export and metadata
assert.equal(metadata.main, './index.cjs', 'Expected package.json main to point to ./index.cjs via committed patch');
assert.ok(metadata.exports, 'Expected package.json exports field');
assert.equal(metadata.exports.require, './index.cjs', 'Expected exports.require to point to ./index.cjs');
assert.equal(metadata.exports.import, './index.js', 'Expected exports.import to point to ./index.js');

const cjsPath = path.join(directory, 'index.cjs');
assert.ok(fs.existsSync(cjsPath), 'Expected patched index.cjs to exist');
const cjsSource = fs.readFileSync(cjsPath, 'utf8');
assert.equal(
  createHash('sha256').update(cjsSource).digest('hex'),
  '684ba79779327ba789733a3a563050370a928a57eb7dd33d19b346f43b32cbb7',
  'Patched CJS decoder source does not match reviewed sha256 checksum'
);

const cjsFunction = require('decode-uri-component');
assert.equal(typeof cjsFunction, 'function', 'Patched decode-uri-component must export a function via CommonJS require');
