// The verdict for sending to one address on one chain, from what every chain says about that address. Pure: the
// facts come from check.js (or a test).
//
// facts = {
//   address, target,                      the address and the chain ID the funds go to
//   chains: { [chainId]: { code, nonce, safe?, token? } },   code "0x" = none, null = could not read
//   abstractWallet,                       the address is in the archive of Abstract Global Wallets
// }
// The answer: { level: "safe" | "caution" | "stop" | "unknown", kind, title, reasons[], recovery, unread[] }, where
// recovery says who could reach funds already sent there: "owner", "maybe", "none", or null when unknown.
import { chainName as name } from "./chains.js";

/** "none", "eip7702" (a key wallet that delegates to a smart-account contract), "contract", or "unknown" (unread). */
export function kindOfCode(code) {
  if (code == null) return "unknown";
  if (code === "0x") return "none";
  if (/^0xef0100[0-9a-f]{40}$/i.test(code)) return "eip7702";
  return "contract";
}

const list = (ids) => ids.map(name).join(", ");
const EXCHANGE = "If this is an exchange deposit address, also check that the exchange accepts this network and token. An exchange can hold the key and still not credit you.";

/** The same owners and the same threshold, in any order. Older facts carry only the counts. */
function sameSafe(a, b) {
  if (a.threshold !== b.threshold || a.owners !== b.owners) return false;
  if (!a.signers || !b.signers) return true;
  const key = (s) => [...s.signers].map((x) => x.toLowerCase()).sort().join();
  return key(a) === key(b);
}

export function classify(f) {
  const t = f.target;
  const here = f.chains[t] ?? { code: null, nonce: null };
  const others = Object.entries(f.chains).map(([id, c]) => [Number(id), c]).filter(([id]) => id !== t);
  const unread = others.filter(([, c]) => c.code == null).map(([id]) => id);
  const out = (v) => ({ recovery: null, reasons: [], unread, ...v });

  if (f.abstractWallet) {
    if (t === 2741) {
      return out({
        level: "caution", kind: "abstract-wallet", recovery: "owner",
        title: "An Abstract Global Wallet. It works on Abstract only until Abstract shuts down on 15 Dec 2026",
        reasons: ["Abstract shuts down on 15 Dec 2026; anything left on it then can no longer be reached. Move funds out, to a key wallet's address on the destination chain."],
      });
    }
    if (t === 324) {
      return out({
        level: "caution", kind: "abstract-wallet", recovery: "owner",
        title: "An Abstract Global Wallet. It does not exist on ZKsync Era yet: don't send",
        reasons: [
          "This address is a smart wallet created on Abstract. Abstract and ZKsync Era both run EraVM, and Abstract's wallet factory, wallet code, registry and signer validator are deployed at the same addresses on ZKsync Era (checked 26 Oct 2026).",
          "So if funds were already sent here, the wallet's owner can most likely deploy this same wallet on ZKsync Era with its original signer and reach them. Don't send on purpose.",
        ],
      });
    }
    return out({
      level: "stop", kind: "abstract-wallet", recovery: "none",
      title: `Stop: this is an Abstract Global Wallet. Funds sent to it on ${name(t)} are lost for good`,
      reasons: [
        "This address is a smart wallet that exists only on Abstract (chain 2741), created by Abstract's wallet factory.",
        `On ${name(t)} nothing lives at this address and no private key exists for it. Abstract runs EraVM, which derives contract addresses differently from ${name(t)}, so the wallet can never be created here at this address.`,
        "Nobody can recover funds sent here: not you, not Abstract, not the chain. Ignore anyone who offers to.",
      ],
    });
  }

  const k = kindOfCode(here.code);
  if (k === "unknown") {
    return out({ level: "unknown", kind: "unreadable", title: `Could not read ${name(t)}`, reasons: [`The public RPCs for ${name(t)} did not answer. Try again in a minute.`] });
  }
  if (k === "eip7702") {
    return out({
      level: "safe", kind: "eip7702", recovery: "owner", title: "Safe: a key wallet with smart-account features (EIP-7702)",
      reasons: [`On ${name(t)} this address delegates to a smart-account contract, but it is still a normal key wallet: its private key works on every EVM chain.`],
    });
  }
  if (k === "contract") {
    if (here.safe) {
      const differ = others.filter(([, c]) => c.safe && !sameSafe(c.safe, here.safe));
      if (differ.length) {
        const [[first, c], ...rest] = differ;
        const also = rest.length ? `, and it has different owners on ${list(rest.map(([id]) => id))} too` : "";
        return out({
          level: "caution", kind: "safe-differs", recovery: "maybe", title: `Caution: this Safe has different owners on other chains`,
          reasons: [
            `It is a ${here.safe.threshold}-of-${here.safe.owners} Safe on ${name(t)}, but a ${c.safe.threshold}-of-${c.safe.owners} Safe on ${name(first)}${also}.`,
            `The same address can belong to different people on different chains. Funds sent here go to the owners on ${name(t)}.`,
            `Check with the recipient that they control this Safe on ${name(t)}.`,
          ],
        });
      }
      return out({
        level: "safe", kind: "safe-here", recovery: "owner", title: `Safe: a Safe multisig deployed on ${name(t)}`,
        reasons: [`It is a ${here.safe.threshold}-of-${here.safe.owners} Safe on ${name(t)}; its owners can move what it receives.`],
      });
    }
    if (here.token) {
      return out({
        level: "stop", kind: "token-contract", recovery: "none", title: `Stop: this is the ${here.token.symbol} token contract itself`,
        reasons: ["Tokens sent to a token's own contract usually stay stuck there. Send to the recipient's wallet address instead."],
      });
    }
    return out({
      level: "caution", kind: "contract-here", recovery: "maybe", title: `Caution: this address is a contract on ${name(t)}`,
      reasons: ["Funds sent to a contract can only leave it if the contract was written to move them, like a smart wallet you control on this chain. Make sure that is what this is."],
    });
  }

  // No code on the target chain.
  if (here.nonce > 0) {
    return out({
      level: "safe", kind: "key-wallet", recovery: "owner", title: "Safe: a normal key wallet",
      reasons: [`It has sent ${here.nonce} transaction${here.nonce === 1 ? "" : "s"} on ${name(t)}, so someone holds its private key, and that key works on every EVM chain.`, EXCHANGE],
    });
  }
  const used = others.filter(([, c]) => kindOfCode(c.code) === "none" && c.nonce > 0).map(([id]) => id);
  if (used.length) {
    return out({
      level: "safe", kind: "key-wallet", recovery: "owner", title: "Safe: a normal key wallet",
      reasons: [`It has sent transactions on ${list(used)}, so someone holds its private key, and the same key controls it on ${name(t)}.`, EXCHANGE],
    });
  }
  const delegated = others.filter(([, c]) => kindOfCode(c.code) === "eip7702").map(([id]) => id);
  if (delegated.length) {
    return out({
      level: "safe", kind: "eip7702", recovery: "owner", title: "Safe: a key wallet with smart-account features (EIP-7702)",
      reasons: [`On ${list(delegated)} it is a key wallet with an EIP-7702 delegation; its private key controls it on ${name(t)} too.`],
    });
  }
  const safes = others.filter(([, c]) => kindOfCode(c.code) === "contract" && c.safe);
  if (safes.length) {
    const s = safes[0][1].safe;
    const where = list(safes.map(([id]) => id));
    return out({
      level: "stop", kind: "safe-elsewhere", recovery: "maybe", title: `Stop: this Safe exists on ${where}, not on ${name(t)}`,
      reasons: [
        `It is a ${s.threshold}-of-${s.owners} Safe on ${where} and has no code on ${name(t)}.`,
        `Funds sent here can only be reached if the same Safe is created at this address on ${name(t)}. That works for many Safes but not all, and for some older Safes a stranger can do it first and take the funds (Wintermute lost 20M OP this way in 2022).`,
        "Don't send. Ask the owner for an address on this chain.",
      ],
    });
  }
  const contracts = others.filter(([, c]) => kindOfCode(c.code) === "contract").map(([id]) => id);
  if (contracts.length) {
    return out({
      level: "stop", kind: "contract-elsewhere", recovery: "none", title: `Stop: this address is a contract on ${list(contracts)}, not on ${name(t)}`,
      reasons: [
        `It has code on ${list(contracts)} and none on ${name(t)}: it is a smart contract, often a smart wallet, that only exists there.`,
        `Funds sent here could only be reached by creating the same contract at this address on ${name(t)}, which is usually impossible.`,
      ],
    });
  }
  return out({
    level: "unknown", kind: "unused", title: "Can't tell: this address has never been used on any chain checked",
    reasons: ["A brand-new key wallet looks like this, and so does a smart wallet that has not been deployed yet. If you send, send a small test first."],
  });
}
