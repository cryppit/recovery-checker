// Verified Safe (Gnosis Safe) deployment constants and the PURE mapping from a proxy's storage slot-0 singleton to a
// Safe version and recovery model. Source of truth: @safe-global/safe-deployments, distilled in
// docs/superpowers/specs/2026-11-10-recovery-checker-mechanics.md. No I/O here — the reads that use these constants
// live in the thin caller (lookup.js).
//
// A Safe address is reproducible on another chain ONLY if the factory, singleton, initializer, salt(saltNonce) and
// proxy creation code ALL match. Version decides the model: v1.3.0/v1.4.1 use CREATE2 (an owner can redeploy, with a
// deploy race); v1.0.0/v1.1.1 use the create opcode (address = f(deployer, nonce) — not owner-reproducible).

/** The low 20 bytes of slot 0 are the singleton (mastercopy) address, or null for an empty/invalid slot. */
export function singletonFromSlot0(hex) {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]*$/.test(hex)) return null;
  const clean = hex.slice(2).padStart(64, "0");
  if (clean.length < 40) return null;
  const addr = "0x" + clean.slice(-40).toLowerCase();
  if (/^0x0{40}$/.test(addr)) return null; // slot is empty: not a Safe proxy we can read
  return addr;
}

// Singleton address (lowercased) -> Safe version. Verified against @safe-global/safe-deployments.
const SINGLETON_VERSION = new Map(Object.entries({
  // v1.4.1 (CREATE2)
  "0x41675c099f32341bf84bfc5382af534df5c7461a": "v1.4.1", // Safe
  "0x29fcb43b46531bca003ddc8fcb67ffe91900c762": "v1.4.1", // SafeL2
  "0xc35f063962328ac65ced5d4c3fc5def8dec68dfa": "v1.4.1", // zkSync Safe
  // v1.3.0 (CREATE2)
  "0x3e5c63644e683549055b9be8653de26e0b4cd36e": "v1.3.0", // GnosisSafeL2 canonical
  "0xfb1bffc9d739b8d520daf37df666da4c687191ea": "v1.3.0", // GnosisSafeL2 eip155
  "0x1727c2c531cf966f902e5927b98490fdfb3b2b70": "v1.3.0", // GnosisSafeL2 zkSync
  "0xd9db270c1b5e3bd161e8c8503c55ceabee709552": "v1.3.0", // GnosisSafe canonical
  // Legacy (create opcode) — not owner-reproducible on another chain
  "0x34cfac646f301356faa8b21e94227e3583fe3f5f": "v1.1.1",
  "0xb6029ea3b2c51d09a50b53ca8012feeb05bda35a": "v1.0.0",
}));

/** A Safe version string ("v1.4.1" | "v1.3.0" | "v1.1.1" | "v1.0.0") or "unknown". */
export function versionOfSingleton(singleton) {
  if (!singleton) return "unknown";
  return SINGLETON_VERSION.get(singleton.toLowerCase()) ?? "unknown";
}

/** The recovery model for a version: "create2" (redeployable with risk), "legacy" (create opcode), or "unknown". */
export function safeModel(version) {
  if (version === "v1.4.1" || version === "v1.3.0") return "create2";
  if (version === "v1.1.1" || version === "v1.0.0") return "legacy";
  return "unknown";
}

// Version -> SafeProxyFactory addresses (lowercased) to probe on the DESTINATION chain. The factory is "present" if
// code exists at ANY of them (chains deployed the canonical, eip155 or zkSync variant). CREATE2 versions only.
export const SAFE_FACTORIES = {
  "v1.4.1": [
    "0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67", // canonical
    "0xc329d02fd8cb2fc13aa919005af46320794a8629", // zkSync
  ],
  "v1.3.0": [
    "0xa6b71e26c5e0845f74c812102ca7114b6a896ab2", // canonical
    "0xc22834581ebc8527d974f8a1c97e1bea4ef910bc", // eip155
    "0xdaec33641865e4651fb43181c6db6f7232ee91c2", // zkSync
  ],
};

// zkSync/Era-stack chains: EraVM derives CREATE2 addresses by a different formula, so a standard EVM Safe cannot be
// reproduced at the same address on these chains (jonluca/safe-everywhere excludes zkSync Era for exactly this reason).
export const ZK_STACK_CHAINS = new Set([324, 2741]); // ZKsync Era, Abstract
