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
| **Possibly recoverable** (`yes-with-risk`) | A Gnosis Safe deployed elsewhere. A Safe address is deterministic, so you *may* redeploy the identical Safe on the destination chain and regain control. Carries a deploy-race risk — read every warning. |
| **Very likely unrecoverable** (`likely-no`) | An Abstract Global Wallet. The address can't be reproduced on the destination chain. No false recovery steps are shown. |
| **Danger — occupied** (`danger`) | An address already has contract code on the destination chain. Funds sent there are controlled by whoever owns that contract — which may not be you. |
| **Unknown** (`unknown`) | Either a smart-contract wallet we can't classify, or an address that's never been used. We won't guess; unproven is shown as unknown, never a yes. |
| **Not a smart-wallet case** (`not-applicable`) | A regular key-controlled address. If you hold the key, the funds are already yours to move. |

The conservative default is **unknown**: a wrong "recoverable" could cost someone everything, so anything the tool
cannot positively classify is reported as unknown, not guessed.

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
  recovery verdict `{ class, recoverable, title, headline, steps, warnings, sources }`.
- `src/lookup.js` — the thin bridge: `check()` then `recover(facts)`.
- `index.html` + `src/page.js` — the page. Strict CSP, `textContent` only (nothing from a chain is ever set as HTML),
  no analytics, no storage.

The design borrows the Safe to Send engine; the recovery logic and UI are new.

## Security

Read-only and keyless by construction. See [SECURITY.md](SECURITY.md). MIT licensed.
