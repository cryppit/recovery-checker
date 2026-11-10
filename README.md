# Recovery Checker

**Sent money to a smart-wallet address on the wrong chain? This tells you whether it can be recovered — honestly.**

Paste the address and pick the chain the funds landed on. The tool reads public chains and answers:

- whether the funds can be recovered, and
- the risky steps if they can — but it **never does them for you**.

It is **keyless and read-only**. It never asks for a seed phrase, private key or OTP (and would refuse one if
pasted), holds no funds, and **never deploys or signs anything**. Any deployment you attempt to recover funds, you do
yourself, with your own keys, at your own risk.

Some losses are usually unrecoverable and we say so plainly. An **Abstract Global Wallet** (AGW) address is derived by
Abstract's account-abstraction model and cannot be reproduced on an ordinary EVM chain — so funds sent to it on the
wrong chain are very likely gone, and anyone who claims they can recover them is not telling the truth.

## What it can tell you

| Verdict | Meaning |
|---|---|
| **Possibly recoverable** (`yes-with-risk`) | A modern **CREATE2** Gnosis Safe (v1.3.0 / v1.4.1) whose matching `SafeProxyFactory` *is* deployed on the destination chain. A CREATE2 Safe address is deterministic, so the owner *may* redeploy the identical Safe (`createProxyWithNonce`, same factory + singleton + initializer + saltNonce) and regain control. Carries a deploy-race risk — read every warning. |
| **Very likely unrecoverable** (`likely-no`) | An Abstract Global Wallet (EraVM-derived address, not reproducible on an ordinary EVM chain), **or** a legacy create-opcode Safe (v1.0.0 / v1.1.1) whose address came from `create(deployer, nonce)` — a normal owner can't reproduce the deployer's nonce on a new chain. No false recovery steps are shown. |
| **Danger — occupied** (`danger`) | An address already has contract code on the destination chain. Funds sent there are controlled by whoever owns that contract — which may not be you. |
| **Unknown** (`unknown`) | A CREATE2 Safe whose factory isn't on the destination (or we couldn't confirm it), a Safe whose version we couldn't read, a smart-contract wallet we can't classify, or an address never used. We won't guess; unproven is shown as unknown, never a yes. |
| **Not a smart-wallet case** (`not-applicable`) | A regular key-controlled address. If you hold the key, the funds are already yours to move. |

**Why the Safe answer is version-aware.** A Safe address is only reproducible on another chain if the factory,
singleton (mastercopy), initializer (owners, threshold, fallback handler), salt (`saltNonce`) and proxy creation code
*all* match. "A Safe exists elsewhere" is **not** enough. The tool reads the proxy's storage slot 0 on a chain where
the Safe is deployed to identify the version, and — for CREATE2 versions — reads `eth_getCode` at that version's
canonical `SafeProxyFactory` on the destination chain to confirm the factory is actually there. Reference:
`@safe-global/safe-deployments`, Safe multi-chain docs, and [jonluca/safe-everywhere](https://github.com/jonluca/safe-everywhere)
(opt-in replay for v1.3.0/1.4.1/1.5.0, which excludes zkSync Era). Replaying a legacy proxy factory this way is exactly
the mechanism behind the 2022 Wintermute/Optimism 20M OP theft.

The conservative default is **unknown**: a wrong "recoverable" could cost someone everything, so anything the tool
cannot positively classify — including any Safe read failure — is reported as unknown, not guessed.

## Run the tests

No install, no `node_modules`, no build step — plain ES modules, Node ≥ 22:

```bash
node --test "test/*.test.js"
# or
npm test
```

Tests replay real RPC answers recorded for the sibling tool (no network).

## How it's built

- `src/rpc.js`, `src/chains.js`, `src/classify.js`, `src/archive.js`, `src/check.js` — the read engine, copied
  **verbatim** from the [Safe to Send](https://github.com/cryppit) tool. `check(address, target, …)` reads every chain
  and returns `{ facts, verdict }`.
- `src/recover.js` — **the new core.** `recover(facts)` is a pure function (no I/O) that turns those facts into a
  recovery verdict `{ class, recoverable, title, headline, steps, warnings, sources }`. For a Safe it branches on
  `facts.safeVersion` and `facts.destFactoryPresent`, which the caller pre-reads.
- `src/safe.js` — pure Safe constants (verified singletons + factories from `@safe-global/safe-deployments`) and the
  slot-0 → singleton → version → model mapping.
- `src/lookup.js` — the thin bridge and the only I/O: `check()`, then (for a Safe found elsewhere) read slot 0 for the
  version and probe the factory on the destination, then `recover(facts)`.
- `index.html` + `src/page.js` — the page. Strict CSP, `textContent` only (nothing from a chain is ever set as HTML),
  no analytics, no storage.

The design borrows the Safe to Send engine; the recovery logic and UI are new.

## Security

Read-only and keyless by construction. See [SECURITY.md](SECURITY.md). MIT licensed.
