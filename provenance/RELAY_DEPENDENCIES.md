# Durable Relay dependency provenance

Snapshot date: 2026-08-29 SGT.

## NATS Server / JetStream

- Project: <https://github.com/nats-io/nats-server>
- Release: <https://github.com/nats-io/nats-server/releases/tag/v2.14.5>
- Archive: <https://github.com/nats-io/nats-server/releases/download/v2.14.5/nats-server-v2.14.5-darwin-arm64.tar.gz>
- Release checksum manifest: <https://github.com/nats-io/nats-server/releases/download/v2.14.5/SHA256SUMS>
- Manifest SHA-256: `2e842f2670eb0eed2c65f2a58ac3f0c439256d607e9654ebd6999859c18ed0e0`
- Archive SHA-256: `ddd907854d9a2de834af133fa396915fe6442fe6d8909ae31390d1ea7a0fea50`
- Observed binary version: `nats-server: v2.14.5`
- Licence: Apache-2.0; preserved in
  [`LICENSES/NATS-Apache-2.0.txt`](../LICENSES/NATS-Apache-2.0.txt), SHA-256
  `c95bae1d1ce0235ecccd3560b772ec1efb97f348a79f0fbe0a634f0c2ccefe2c`.
- Reproducible acquisition: [`scripts/acquire-nats.sh`](../scripts/acquire-nats.sh).

The manifest digest is hard-coded before its archive entry is trusted. The
binary and extracted archive remain ignored under `.local/`; they are not
committed.

## NATS JavaScript packages

All three direct dependencies are pinned exactly at `3.4.0`, resolved from the
npm registry, locked by `package-lock.json`, and Apache-2.0 licensed.

| Package | Registry archive | Lockfile integrity |
| --- | --- | --- |
| `@nats-io/transport-node` | <https://registry.npmjs.org/@nats-io/transport-node/-/transport-node-3.4.0.tgz> | `sha512-hH7u7ejIBTFEJIZ8rIcMrHJI6wl+HhpO5sVFs1+ppmXa8RuB2+Lh1+UwTzZ5xTNNm1TKcRkYy+2qCV56qp8RxA==` |
| `@nats-io/jetstream` | <https://registry.npmjs.org/@nats-io/jetstream/-/jetstream-3.4.0.tgz> | `sha512-GzHQodNJ942+R5LRb8PuZ5ugVWVWMRiufxUYLLVWkXKfwDXYN+Owo0d7L/b9O7BPyrbYD7jQWAC6+ZVuXa9Gyw==` |
| `@nats-io/kv` | <https://registry.npmjs.org/@nats-io/kv/-/kv-3.4.0.tgz> | `sha512-168pcRJxWcIRHwdyczI3DaGk5r3CAj3CyKXuk4Nmx5KKj7N1znQOJPIxCoV0TPlAvoTidVb7eBv41J9imapMeQ==` |

The locked NATS dependency graph also includes Apache-2.0 packages
`@nats-io/nats-core@3.4.0`, `@nats-io/nkeys@2.0.3`, and
`@nats-io/nuid@3.0.0`, plus `tweetnacl@1.0.3` under the Unlicense. The latter
licence is preserved in
[`LICENSES/TweetNaCl-Unlicense.txt`](../LICENSES/TweetNaCl-Unlicense.txt),
SHA-256
`60d2c28d19d2bdf7bbaa59829e7a595234265e8111a01ccb74d25d6c4d2d013a`.

No code was copied from an unrelated leaked bot or private system. The relay
protocol, tests, API integration, and UI in this repository are original work
built against documented NATS APIs.
