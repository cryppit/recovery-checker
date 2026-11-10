// Read what every chain says about one address, then classify sending to it on one chain. Works the same in a
// browser and in Node; `clients` and `loadShard` are swapped for recorded answers in the tests.
import { makeRpc } from "./rpc.js";
import { CHAINS, chainById } from "./chains.js";
import { ABSTRACT, normalize, shardOf, inShard } from "./archive.js";
import { classify, kindOfCode } from "./classify.js";

const SELECTOR = {
  getThreshold: "0xe75235b8", // Safe
  getOwners: "0xa0e67e2b", // Safe
  symbol: "0x95d89b41", // ERC-20
  decimals: "0x313ce567", // ERC-20
  isAGW: "0x932bdb47", // Abstract's AGW registry
};

export const clientsFor = (chain) => makeRpc(chain.rpcs, { timeoutMs: 6_000 });

const wordAt = (hex, i) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
const hasWords = (r, n) => typeof r === "string" && r.length >= 2 + 64 * n;
const uint = (hex, i) => BigInt("0x" + wordAt(hex, i));

/** An eth_call answer, or null when it reverted (an EOA or a contract without the function answers "0x"). */
export async function view(rpc, to, data) {
  const r = await rpc("eth_call", [{ to, data }, "latest"]);
  return r && !r.reverted && r !== "0x" ? r : null;
}

/** An ABI string, or a bytes32 symbol from older tokens; null if it is neither. */
function decodeSymbol(hex) {
  const bytes = (h) => (h.match(/../g) ?? []).map((b) => parseInt(b, 16));
  if (hasWords(hex, 3) && uint(hex, 0) === 32n) {
    const len = Number(uint(hex, 1));
    if (len > 0 && len <= 32) return new TextDecoder().decode(new Uint8Array(bytes(hex.slice(130, 130 + len * 2))));
  }
  if (hex.length === 66) {
    const s = new TextDecoder().decode(new Uint8Array(bytes(hex.slice(2)).filter(Boolean)));
    if (/^[\x20-\x7e]{1,32}$/.test(s)) return s;
  }
  return null;
}

/** Code and nonce on one chain; for a contract, whether it is a Safe, and on the target chain whether it is a token. */
async function readChain(address, rpc, isTarget) {
  try {
    const [code, nonce] = await Promise.all([rpc("eth_getCode", [address, "latest"]), rpc("eth_getTransactionCount", [address, "latest"])]);
    const out = { code, nonce: Number(nonce) };
    if (kindOfCode(code) !== "contract") return out;
    const [threshold, owners] = await Promise.all([view(rpc, address, SELECTOR.getThreshold), view(rpc, address, SELECTOR.getOwners)]);
    if (hasWords(threshold, 1) && hasWords(owners, 2)) {
      const t = Number(uint(threshold, 0)), n = Number(uint(owners, 1));
      if (t > 0 && n >= t && n < 1000 && hasWords(owners, 2 + n)) {
        const signers = Array.from({ length: n }, (_, i) => "0x" + wordAt(owners, 2 + i).slice(24));
        out.safe = { threshold: t, owners: n, signers };
      }
    }
    if (isTarget && !out.safe) {
      const [symbol, decimals] = await Promise.all([view(rpc, address, SELECTOR.symbol), view(rpc, address, SELECTOR.decimals)]);
      const s = symbol && hasWords(decimals, 1) ? decodeSymbol(symbol) : null;
      if (s) out.token = { symbol: s };
    }
    return out;
  } catch {
    return { code: null, nonce: null }; // every endpoint failed; the verdict lists the chain as unread
  }
}

/**
 * Check sending to `address` on chain `target` (a chain ID).
 * `loadShard(key)` returns the archive shard for addresses starting 0x<key> (a Uint8Array), or null if there is none.
 */
export async function check(address, target, { clients = clientsFor, loadShard = async () => null, chains = CHAINS } = {}) {
  try {
    normalize(address);
  } catch {
    return { error: "bad-address", message: "That is not an EVM address (0x followed by 40 hex characters)." };
  }
  if (!chainById(target)) return { error: "bad-chain", message: `Unknown chain ${target}.` };
  const addr = address.toLowerCase();

  const read = await Promise.all(chains.map((c) => readChain(addr, clients(c), c.id === target).then((f) => [c.id, f])));
  const facts = { address: addr, target, chains: Object.fromEntries(read), abstractWallet: false, abstractSource: null };

  // The archive answers even after Abstract is gone; while Abstract runs, its AGW registry is asked too.
  const shard = await loadShard(shardOf(addr)).catch(() => null);
  if (shard && inShard(shard, addr)) Object.assign(facts, { abstractWallet: true, abstractSource: "archive" });
  const onAbstract = facts.chains[ABSTRACT.chainId];
  if (onAbstract && kindOfCode(onAbstract.code) === "contract") {
    try {
      const r = await view(clients(chainById(ABSTRACT.chainId)), ABSTRACT.registry, SELECTOR.isAGW + addr.slice(2).padStart(64, "0"));
      const registered = hasWords(r, 1) && uint(r, 0) === 1n;
      facts.abstractRegistry = registered;
      if (registered && !facts.abstractWallet) Object.assign(facts, { abstractWallet: true, abstractSource: "registry" });
    } catch {
      facts.abstractRegistry = null;
    }
  }
  return { facts, verdict: classify(facts) };
}
