# Codex `0.111.0` local Runtime security block — 2026-08-29

This records a failed, immediately stopped compatibility probe. It is not a
successful Runtime reproduction.

## Purpose and source identity

The organizer starter installs `@openai/codex@0.111.0`. A temporary ignored
workspace used npm `10.9.8` and Node.js `22.23.2` to install that exact package
and its macOS arm64 platform alias. The registry platform tarball reported:

```text
name: @openai/codex
version: 0.111.0-darwin-arm64
package size: 38.4 MB
unpacked size: 88.9 MB
registry SHA-1: 699d0b8589f37d426ce96f853859f635132571f3
```

The extracted executable's observed SHA-256 was
`d5bbadc9099324684c2d2ee4b4b57ee67e967a89f245101f5fc3a9a4bf44b33d`.
Before execution, `codesign -dv` displayed Developer ID Application `OpenAI,
L.L.C. (2DC432GLL2)` and timestamp `6 Mar 2026 at 2:20:29 AM`. Those identity
observations do not override an operating-system malware decision.

## Observed result

Attempting `codex-0.111.0 --version` produced no version output. macOS then
displayed:

```text
Malware Blocked and Moved to Bin
“codex-0.111.0” was not opened because it contains malware.
This action did not harm your Mac.
```

The executable disappeared from the extraction directory because macOS moved
it. No Gatekeeper override, quarantine removal, Bin restoration, alternate
execution technique, or retry was attempted. The remaining ignored
`workspaces/codex-contract-probe` directory, including the platform tarball,
was deleted. No credential was present or accessed and no repository source
file was affected.

## Safe conclusion

- The starter-pinned macOS binary is **blocked and not reproduced** on this
  host.
- This observation does not prove whether the Linux platform package has the
  same issue; it was not downloaded or executed.
- The current app-bundled `codex-cli 0.150.0-alpha.12.2` is available, but it is
  not substituted as organizer-baseline evidence because it is a different
  version.
- Compatibility work may continue through the official source tag, generated
  schema, application unit tests, and deterministic gateways. No blocked
  binary will be restored or bypassed.
