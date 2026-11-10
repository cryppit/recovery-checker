// The archive of Abstract Global Wallets: every wallet the AGW factory ever deployed on Abstract (chain 2741), kept
// as a plain list after the chain shuts down on 15 Dec 2026, so a check can still say "this address is an Abstract
// wallet; nothing can reach funds sent to it on another chain".
//
// Abstract runs EraVM: each deployment emits ContractDeployed(deployer, bytecodeHash, contractAddress) from the
// ContractDeployer system contract (0x…8006), with all three fields indexed.

export const ABSTRACT = {
  chainId: 2741,
  rpcs: ["https://api.mainnet.abs.xyz"],
  // @abstract-foundation/agw-client 1.12.3 SMART_ACCOUNT_FACTORY_ADDRESS; the AGW registry's only FactorySet (block
  // 76,852), never unset (checked 26 Oct 2026). The factory has code from block 76,851.
  factory: "0x9b947df68d35281c972511b3e7bc875926f26c1a",
  factoryFromBlock: 76_851,
  registry: "0xd5e3efda6bb5ab545cc2358796e96d9033496dda",
  contractDeployer: "0x0000000000000000000000000000000000008006",
  contractDeployedTopic: "0x290afdae231a3fc0bbae8b1af63698b0a1d79b21ad17df0342dfb952fe74f8e5",
};

const word = (address) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");

/** The eth_getLogs filter (without a block range) for every wallet the AGW factory deployed. */
export const factoryFilter = () => ({
  address: ABSTRACT.contractDeployer,
  topics: [ABSTRACT.contractDeployedTopic, word(ABSTRACT.factory)],
});

/** One ContractDeployed log: who deployed what, with which code, in which block. */
export function parseDeployed(log) {
  return {
    address: "0x" + log.topics[3].slice(-40),
    deployer: "0x" + log.topics[1].slice(-40),
    bytecodeHash: log.topics[2],
    block: Number(log.blockNumber),
  };
}

const TOO_MANY = /more than \d+ results/i;

/**
 * Read logs for blocks [from, to] in windows the RPC accepts. Abstract's endpoint refuses an answer of more than
 * 10,000 logs, so a refused window is halved and retried from the same block. After an accepted window the next one
 * is sized from its yield, aiming at `target` logs (at most `span` blocks), so a refusal is rare once the scan has
 * the chain's density. `onPage(logs, lastBlock)` runs once per accepted window, in block order, so the caller can
 * checkpoint `lastBlock`. Any other error stops the scan. Returns the last block covered.
 */
export async function scanLogs(rpc, { filter, from, to, span, target = 5_000, onPage }) {
  let size = span;
  let start = from;
  while (start <= to) {
    const end = Math.min(to, start + size - 1);
    let logs;
    try {
      logs = await rpc("eth_getLogs", [{ ...filter, fromBlock: "0x" + start.toString(16), toBlock: "0x" + end.toString(16) }]);
    } catch (e) {
      if (!TOO_MANY.test(e.message) || size === 1) throw e;
      size = Math.max(1, Math.floor(size / 2));
      continue;
    }
    await onPage(logs, end);
    start = end + 1;
    size = Math.max(1, Math.min(span, Math.floor((size * target) / Math.max(logs.length, 1))));
  }
  return to;
}

/** A 20-byte hex address as 40 lowercase hex characters, or an error. */
export function normalize(address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`not an address: ${address}`);
  return address.slice(2).toLowerCase();
}

/** The shard an address lives in: its first byte, as two hex characters. */
export const shardOf = (address) => normalize(address).slice(0, 2);

// A shard keeps bytes 2-8 of each address (the first byte is the shard's name), so a match is on the first 8 bytes.
// With millions of wallets, a wrong match needs a 64-bit collision: about 1 in 3 trillion per lookup at ~25,000
// wallets per shard. Millions of full addresses would be ~110 MB; 7-byte records keep each shard near 150 KB.
export const RECORD = 7;

const recordOf = (n) => n.slice(2, 2 + RECORD * 2);

/** Group addresses into shards by first byte: each a Uint8Array of sorted, distinct 7-byte records. */
export function buildShards(addresses) {
  const sets = {};
  for (const a of addresses) {
    const n = normalize(a);
    (sets[n.slice(0, 2)] ??= new Set()).add(recordOf(n));
  }
  return Object.fromEntries(Object.entries(sets).map(([k, set]) => [k, Uint8Array.from(Buffer.from([...set].sort().join(""), "hex"))]));
}

/** Whether a shard (sorted 7-byte records) holds the address's record (binary search). */
export function inShard(bytes, address) {
  const want = recordOf(normalize(address));
  const target = new Uint8Array(RECORD);
  for (let i = 0; i < RECORD; i++) target[i] = parseInt(want.slice(i * 2, i * 2 + 2), 16);
  let lo = 0, hi = bytes.length / RECORD - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let cmp = 0;
    for (let i = 0; i < RECORD && cmp === 0; i++) cmp = bytes[mid * RECORD + i] - target[i];
    if (cmp === 0) return true;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
