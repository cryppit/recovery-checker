// Can money sent to a smart-wallet address on the WRONG chain be recovered? recover(facts) answers it. PURE: no I/O,
// no Date.now, no fetch, no randomness. `facts` is exactly what check.js produces (see src/check.js), read-only.
//
// facts = {
//   address,                              the address checked
//   target,                               the chain ID the funds were (or would be) sent to  = the destination
//   chains: { [chainId]: { code, nonce, safe?, token? } },   code "0x" = none, null = could not read
//   abstractWallet,                       true if the address is an Abstract Global Wallet (archive or live registry)
//   safeVersion?,                         when a Safe is found elsewhere: "v1.4.1"|"v1.3.0"|"v1.1.1"|"v1.0.0"|"unknown"
//   destFactoryPresent?,                  for a CREATE2 Safe: is the matching SafeProxyFactory on the dest chain?
// }
// The last two are pre-read by the caller (lookup.js), since they need I/O — recover() stays pure and only branches
// on them. If they are absent (recover called on raw check() facts), a Safe-elsewhere case is treated conservatively
// as "unknown", never as recoverable.
//
// The answer: { class, recoverable, title, headline, steps[], warnings[], sources[] } where
//   recoverable ∈ "yes-with-risk" | "likely-no" | "danger" | "unknown" | "not-applicable".
//
// A wrong "recoverable" could cost someone everything, so the rules are conservative: anything we cannot positively
// classify is "unknown", never a guess, and we never offer a recovery step for a case we do not understand.
import { kindOfCode } from "./classify.js";
import { chainName } from "./chains.js";
import { safeModel } from "./safe.js";

const WINTERMUTE = "this is how the 2022 Wintermute/Optimism 20M OP theft happened: a stranger redeployed a Safe at the victim's CREATE2 address first and took the funds.";

export function recover(facts) {
  const sources = Object.keys(facts.chains).map(Number);
  const out = (v) => ({ steps: [], warnings: [], sources, ...v });

  const target = facts.target;
  const dest = facts.chains[target];
  const destIsContract = kindOfCode(dest?.code) === "contract";

  // Contracts the address has on chains OTHER than the destination.
  const elsewhere = Object.entries(facts.chains)
    .map(([id, c]) => [Number(id), c])
    .filter(([id, c]) => id !== target && kindOfCode(c.code) === "contract");
  const safeElsewhere = elsewhere.find(([, c]) => c.safe);

  // 1. The destination already has code: someone deployed a contract here. Sending more is handing it to whoever
  //    controls that contract. This is the most dangerous case, so it wins first.
  if (destIsContract) {
    const isSafe = Boolean(dest.safe);
    const headline = isSafe
      ? `A Gnosis Safe is already deployed at this address on ${chainName(target)}. You may control it (only if its owners are yours) or someone else deployed it — verify before trusting it.`
      : `An address already has contract code on ${chainName(target)}, the destination chain. Funds sent here are controlled by whoever owns that contract, which may not be you.`;
    const warnings = [
      `Funds sent to this address on ${chainName(target)} are controlled by whoever owns the contract already deployed here.`,
      WINTERMUTE,
      isSafe
        ? "Verify that this Safe's owners are addresses you control before you trust it — a Safe at this address can belong to someone else entirely."
        : "Verify who controls this contract before sending anything; we cannot tell you it is yours.",
    ];
    return out({
      class: "occupied",
      recoverable: "danger",
      title: `Occupied: code already exists on ${chainName(target)}`,
      headline,
      warnings,
    });
  }

  // From here on the destination has NO code (0x or unread treated as no-contract for recovery purposes).

  // 2a. Abstract Global Wallet. Its address comes from EraVM's deployer and cannot be reproduced on an ordinary EVM
  //     destination, so funds there are very likely gone. We say so plainly and offer NO false steps.
  if (facts.abstractWallet) {
    return out({
      class: "agw-not-recoverable",
      recoverable: "likely-no",
      title: `Very likely unrecoverable: an Abstract Global Wallet`,
      headline: `This is an Abstract Global Wallet. Its address is derived by Abstract's account-abstraction model (EraVM) and cannot be reproduced on ${chainName(target)}, so funds sent there are very likely unrecoverable. Do not trust anyone who offers to recover them.`,
      warnings: [
        `No private key exists for this address and the wallet cannot be re-created at it on ${chainName(target)}.`,
        "Ignore any service or person who claims they can recover these funds — they cannot.",
      ],
    });
  }

  // 2b. A Gnosis Safe deployed on other chain(s), none on the destination. Whether it can be redeployed at this
  //     address depends on the Safe's VERSION (its deployment model) and whether the matching factory exists on the
  //     destination. Both are pre-read by the caller into facts.safeVersion and facts.destFactoryPresent.
  if (safeElsewhere) {
    const [whereId, c] = safeElsewhere;
    const where = chainName(whereId);
    const dst = chainName(target);
    const s = c.safe;
    const version = facts.safeVersion ?? "unknown";
    const model = safeModel(version);

    // CREATE2 (v1.3.0 / v1.4.1): redeployable only if the matching SafeProxyFactory is live on the destination.
    if (model === "create2") {
      if (facts.destFactoryPresent === true) {
        return out({
          class: "safe-redeploy",
          recoverable: "yes-with-risk",
          title: `Possibly recoverable: a CREATE2 Safe you may be able to redeploy`,
          headline: `This is a ${s.threshold}-of-${s.owners} Gnosis Safe (${version}) deployed on ${where}, with no code on ${dst}. Safe ${version} uses CREATE2, and its matching SafeProxyFactory IS deployed on ${dst}, so the owner may be able to redeploy the identical Safe at this address and regain control.`,
          steps: [
            `Confirm you have the Safe's original initializer — the exact owners, threshold and fallback handler — and the saltNonce used to create it on ${where}.`,
            `Verify the matching ${version} singleton (mastercopy) and SafeProxyFactory versions on ${dst}.`,
            `Redeploy with createProxyWithNonce using the identical factory, singleton, initializer and saltNonce. Tools like jonluca/safe-everywhere automate this for v1.3.0/1.4.1/1.5.0 (it excludes zkSync Era); see also Safe's multi-chain docs.`,
            `Test on a fork of ${dst} first and confirm the predicted address equals this one, then deploy yourself with your own keys.`,
          ],
          warnings: [
            `DEPLOY RACE — whoever deploys first at this CREATE2 address controls it; ${WINTERMUTE}`,
            "Any mismatch in the factory, singleton, owners, threshold, fallback handler, saltNonce or initializer yields a DIFFERENT address and permanent loss.",
            "We never deploy or sign anything — you do, at your own risk. This tool only reads.",
          ],
        });
      }
      // CREATE2 version, but the factory is absent (false) or we could not confirm it (null/undefined).
      const absent = facts.destFactoryPresent === false;
      return out({
        class: "safe-no-factory",
        recoverable: "unknown",
        title: `Unproven: the Safe factory may not exist on the destination`,
        headline: absent
          ? `This is a ${s.threshold}-of-${s.owners} Gnosis Safe (${version}) on ${where}, but the matching Safe factory for ${version} isn't deployed on ${dst}, so it can't be redeployed there as-is. Expert review is needed — the factory would have to be deployed first, which is not an ordinary owner recovery.`
          : `This is a ${s.threshold}-of-${s.owners} Gnosis Safe (${version}) on ${where}, but we couldn't confirm the matching Safe factory on ${dst}. Until that is verified, treat recovery as unproven — expert review needed.`,
        warnings: [
          "Do not assume these funds are recoverable; redeploying a Safe needs its exact factory, singleton, initializer and saltNonce to all exist and match on the destination chain.",
        ],
      });
    }

    // Legacy create-opcode (v1.0.0 / v1.1.1): the address = f(deployer, nonce). The legitimate owner cannot reproduce
    // the original deployer's nonce on a new chain — only an attacker replaying the old factory could (the Wintermute
    // case). Not owner-recoverable.
    if (model === "legacy") {
      return out({
        class: "safe-legacy-create",
        recoverable: "likely-no",
        title: `Very likely not owner-recoverable: a legacy (create-opcode) Safe`,
        headline: `This is an old Gnosis Safe (${version}, create-opcode era) on ${where}, with no code on ${dst}. Its address came from create(deployer, nonce), and the legitimate owner generally cannot reproduce the original deployer's nonce on ${dst} — so it is not owner-recoverable by redeploying. Expert review needed.`,
        warnings: [
          `Not owner-recoverable by redeployment. ${WINTERMUTE} A normal owner cannot do this; beware anyone who offers to "recover" it.`,
        ],
      });
    }

    // Version unreadable (unknown singleton): stay conservative.
    return out({
      class: "safe-unknown-version",
      recoverable: "unknown",
      title: `Unknown: a Safe whose version we couldn't read`,
      headline: `A Gnosis Safe exists at this address on ${where} but not on ${dst}, and we couldn't read its version (storage slot 0 / singleton) to judge whether it can be redeployed. Treat recovery as unproven — expert review needed.`,
      warnings: [
        "We won't guess. Whether a Safe can be redeployed on another chain depends on its exact version, factory, initializer and saltNonce.",
      ],
    });
  }

  // 2c. A non-Safe contract exists elsewhere but we cannot classify its deployment model. We will not guess.
  if (elsewhere.length) {
    const where = elsewhere.map(([id]) => chainName(id)).join(", ");
    return out({
      class: "smart-wallet-unknown",
      recoverable: "unknown",
      title: `Unknown: a smart-contract wallet we can't classify`,
      headline: `A smart-contract wallet exists at this address on ${where} but not on ${chainName(target)}, and we can't classify its deployment model, so we can't confirm whether it can be recovered. This needs manual review by someone who knows how this wallet was deployed.`,
      warnings: [
        "Do not assume recovery is possible; whether this address can be re-created on the destination depends entirely on how it was originally deployed.",
      ],
    });
  }

  // 2d. No contract anywhere we read.
  const transacted = Object.values(facts.chains).some((c) => kindOfCode(c.code) === "none" && Number(c.nonce) > 0);
  if (transacted) {
    return out({
      class: "not-smart-wallet",
      recoverable: "not-applicable",
      title: `Not a smart wallet: a regular key-controlled address`,
      headline: `This looks like a regular key-controlled address, not a smart wallet — it has sent transactions but holds no contract code. If you hold its private key, funds on ${chainName(target)} are already yours to move. This tool is for smart-wallet-on-the-wrong-chain losses, which this isn't.`,
      warnings: [
        "Never share your seed phrase or private key with anyone, including anyone claiming they will help you recover funds.",
      ],
    });
  }

  // Nothing deployed and nothing transacted anywhere we read: no recovery case to answer.
  return out({
    class: "unused",
    recoverable: "unknown",
    title: `Nothing here: no smart-wallet recovery case`,
    headline: `Nothing is deployed at this address on any chain we read, and it has never transacted. There is no smart-wallet-on-the-wrong-chain recovery case here. If you expected a wallet at this address, double-check the address and the chain.`,
    warnings: [],
  });
}
