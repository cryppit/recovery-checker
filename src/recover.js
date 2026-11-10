// Can money sent to a smart-wallet address on the WRONG chain be recovered? recover(facts) answers it. PURE: no I/O,
// no Date.now, no fetch, no randomness. `facts` is exactly what check.js produces (see src/check.js), read-only.
//
// facts = {
//   address,                              the address checked
//   target,                               the chain ID the funds were (or would be) sent to  = the destination
//   chains: { [chainId]: { code, nonce, safe?, token? } },   code "0x" = none, null = could not read
//   abstractWallet,                       true if the address is an Abstract Global Wallet (archive or live registry)
// }
//
// The answer: { class, recoverable, title, headline, steps[], warnings[], sources[] } where
//   recoverable ∈ "yes-with-risk" | "likely-no" | "danger" | "unknown" | "not-applicable".
//
// A wrong "recoverable" could cost someone everything, so the rules are conservative: anything we cannot positively
// classify is "unknown", never a guess, and we never offer a recovery step for a case we do not understand.
import { kindOfCode } from "./classify.js";
import { chainName } from "./chains.js";

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

  // 2b. A Gnosis Safe deployed on other chain(s), none on the destination. A Safe address is deterministic (CREATE2),
  //     so if the same factory + mastercopy exist on the destination you MAY redeploy the identical Safe and regain
  //     control. Real, but racy — and we never deploy or sign.
  if (safeElsewhere) {
    const [whereId, c] = safeElsewhere;
    const where = chainName(whereId);
    const s = c.safe;
    return out({
      class: "safe-redeploy",
      recoverable: "yes-with-risk",
      title: `Possibly recoverable: a Safe you may be able to redeploy`,
      headline: `This is a ${s.threshold}-of-${s.owners} Gnosis Safe deployed on ${where}, with no code on ${chainName(target)}. A Safe address is deterministic, so if the same Safe factory and mastercopy version exist on ${chainName(target)} you may be able to redeploy the identical Safe at this address and regain control.`,
      steps: [
        `Verify the Safe factory and the matching mastercopy (proxy) version exist on ${chainName(target)}.`,
        "Reproduce the deployment with the EXACT same owners, threshold, salt and initializer that created this Safe on " + where + ".",
        "Test the whole redeploy on a fork of " + chainName(target) + " first, confirming the predicted address matches this one.",
        "Only then deploy on " + chainName(target) + ", yourself, with your own keys.",
      ],
      warnings: [
        `DEPLOY RACE — whoever deploys first at this CREATE2 address controls it; ${WINTERMUTE}`,
        "Wrong owners, threshold, salt or initializer means a different address and permanent loss.",
        "We never deploy or sign anything — you do, at your own risk. This tool only reads.",
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
