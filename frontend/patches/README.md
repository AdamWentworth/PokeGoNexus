# Dependency patches

Install from `frontend/` with `npm ci`. The root postinstall runs
`patch-package --error-on-fail`; patch failures must fail installation.
`npm run test:dependency-security` exercises the installed dependencies and is
required by the web and mobile CI workflows.

## node-forge 1.4.0

`node-forge+1.4.0.patch` backports the `lib/rsa.js` change from
[forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152), commit
`ceba34402e329f0365134f23fe19898756527d65`, for
[GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
The upstream PR is open and there is no published fixed release as of 2026-10-02.

The check rejects extra children inside the nested RSA DigestAlgorithm ASN.1
sequence. It preserves valid algorithm identifiers with an optional NULL
parameter and leaves the existing outer DigestInfo validation in place. Tests
cover malformed structures, valid signatures, and Expo certificate/signing use.
The malformed cases were confirmed to fail against the unpatched package.

The override pins 1.4.0 so this backport cannot silently drift onto another
release. Version-based audits still report the advisory despite the local
mitigation; no audit finding is suppressed or package version falsified.
Installations that skip lifecycle scripts do not receive this patch.

When an upstream release fixes this advisory, update the override and lockfile,
remove the patch, and rerun the security regression suite plus the frontend and
mobile checks. Keep the regression tests after removing the backport.

## query-string 7.1.3

The existing patch keeps the native navigation decoder compatible with the
patched `decode-uri-component` dependency. Its regression tests remain in
`apps/mobile/scripts/query-string-security.test.cjs`.

The former `brace-expansion` CommonJS shim is no longer needed: each minimatch
version resolves its compatible patched dependency family. The dependency
security suite exercises brace patterns through every installed minimatch copy.
