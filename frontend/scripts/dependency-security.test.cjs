const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');

const expoRequire = createRequire(require.resolve('@expo/code-signing-certificates'));
const forge = expoRequire('node-forge');
const expoSigning = expoRequire('@expo/code-signing-certificates');
const { asn1 } = forge;
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyPair = expoSigning.convertKeyPairPEMToKeyPair({
  publicKeyPEM: publicKey.export({ type: 'spki', format: 'pem' }),
  privateKeyPEM: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
const message = Buffer.from('PokeGoNexus dependency security regression');
const digest = crypto.createHash('sha256').update(message).digest('binary');
const nullParameter = () => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '');
const garbage = () => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'unexpected');

// Sign an intentionally constructed DigestInfo so validation is tested independently
// of RSA arithmetic. Unpatched forge accepts extra nested algorithm children.
function signDigestInfo(parameters) {
  const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes()),
      ...parameters,
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
  ]);
  return crypto.privateEncrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(asn1.toDer(info).getBytes(), 'binary'),
  ).toString('binary');
}

test('RSA verification accepts valid DigestInfo with and without optional NULL parameters', () => {
  for (const parameters of [[], [nullParameter()]]) {
    assert.equal(keyPair.publicKey.verify(digest, signDigestInfo(parameters)), true);
  }
  const signature = crypto.sign('sha256', message, privateKey).toString('binary');
  assert.equal(keyPair.publicKey.verify(digest, signature), true);
  const wrongDigest = crypto.createHash('sha256').update('modified').digest('binary');
  assert.equal(keyPair.publicKey.verify(wrongDigest, signature), false);
});

for (const [name, parameters] of [
  ['NULL followed by garbage', [nullParameter(), garbage()]],
  ['garbage without NULL', [garbage()]],
  ['duplicate NULL parameters', [nullParameter(), nullParameter()]],
]) {
  test(`RSA verification rejects nested DigestAlgorithm ${name}`, () => {
    assert.throws(
      () => keyPair.publicKey.verify(digest, signDigestInfo(parameters)),
      /does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo/,
    );
  });
}

test('Expo code-signing certificates, signatures and certificate requests remain valid', () => {
  const now = Date.now();
  const certificate = expoSigning.generateSelfSignedCodeSigningCertificate({
    keyPair,
    validityNotBefore: new Date(now - 60_000),
    validityNotAfter: new Date(now + 60_000),
    commonName: 'PokeGoNexus test fixture',
  });
  expoSigning.validateSelfSignedCertificate(certificate, keyPair);
  const signature = expoSigning.signBufferRSASHA256AndVerify(keyPair.privateKey, certificate, message);
  assert.equal(crypto.verify('sha256', message, publicKey, Buffer.from(signature, 'base64')), true);
  assert.equal(expoSigning.generateCSR(keyPair, 'PokeGoNexus test fixture').verify(), true);
});

test('installed minimatch consumers retain brace expansion compatibility', () => {
  const root = path.resolve(__dirname, '..');
  const lock = require('../package-lock.json');
  const packages = Object.keys(lock.packages).filter(p => /(?:^|\/)node_modules\/minimatch$/.test(p));
  for (const packagePath of packages) {
    const minimatch = require(path.join(root, packagePath));
    const match = typeof minimatch === 'function' ? minimatch : minimatch.minimatch;
    assert.equal(match('file.ts', '*.{js,ts}'), true, packagePath);
    assert.equal(match('file.css', '*.{js,ts}'), false, packagePath);
  }
});

test('fast-uri normalizes percent-encoded hostname case consistently', () => {
  const uri = require('fast-uri');
  assert.equal(uri.parse('//%41.com').host, 'a.com');
  assert.equal(uri.equal('//%41.com', '//a.com'), true);
});

test('Xcode tooling retains CommonJS UUID generation and rejects undersized UUID buffers', () => {
  const xcodeRequire = createRequire(require.resolve('xcode'));
  const uuid = xcodeRequire('uuid');
  assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(() => uuid.v5('test', uuid.v5.DNS, Buffer.alloc(1)), RangeError);
});
