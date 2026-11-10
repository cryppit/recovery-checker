// The example flow on the page: real addresses and the recovery answer each one really gets. These are illustrative
// examples, not a live check — the page says so. The verdict levels and tones match recover.js / page.js exactly.
// test/scenes.test.js checks every scene maps to a gate and is well formed. Addresses were confirmed on 10 Nov 2026.
//
// Each scene: { label, address (real/example), shown (short), icon (chain logo name of where it lives),
//   target (destination chain id), level (verdict level), title, detail }.
export const SCENES = [
  {
    label: "CREATE2 Safe",
    address: "0x1d31f4bdc557bca4df3d238f089cecb3b7135fda", shown: "0x1d31…5fda",
    icon: "ethereum", from: "Ethereum", target: 8453, level: "yes-with-risk",
    title: "Possibly recoverable",
    detail: "A 3-of-5 Safe that lives on Ethereum but has no code on Base. Safe uses CREATE2 and its factory is on Base, so the owner may be able to redeploy the identical Safe here — a real path, with a deploy-race risk.",
  },
  {
    label: "Token contract",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", shown: "USDC 0xA0b8…eB48",
    icon: "ethereum", from: "Ethereum", target: 1, level: "danger",
    title: "Occupied — code already there",
    detail: "This is the USDC token contract on Ethereum. Something already has code at this address, so don't send more without verifying who controls it.",
  },
  {
    label: "Abstract wallet",
    address: "0xd8b17dbd34391993ee11b501e6275bbc715e2529", shown: "0xd8b1…2529",
    icon: "abstract", from: "Abstract", target: 56, level: "likely-no",
    title: "Very likely unrecoverable",
    detail: "An Abstract Global Wallet. Its address is derived by Abstract's own account model (EraVM) and cannot be reproduced on BNB Chain, so funds there are very likely gone. Don't trust anyone who offers to recover them.",
  },
  {
    label: "Never-used address",
    address: "0x308910206Fe935542E6238E4EB8A3718DE7AE305", shown: "demo 0x3089…E305",
    icon: "ethereum", from: "unused", target: 1, level: "unknown",
    title: "Unknown — can't confirm",
    detail: "Never used on any chain we read. A brand-new wallet and an undeployed smart wallet look identical, so we can't confirm recovery. Treat it as unproven and send a small test first.",
  },
];

// The four answers the Recovery Checker can end on, with the glyph, word and tone used across the page (page.js VERDICT
// and the legend). `tone` keys the yes / no / danger / unknown colour tokens; colour is always paired with glyph + word.
export const GATES = [
  { level: "yes-with-risk", mark: "⚠", tone: "yes", name: "Possibly recoverable", note: "A real path, with risk" },
  { level: "danger", mark: "⚑", tone: "danger", name: "Occupied", note: "Verify who controls it" },
  { level: "likely-no", mark: "✗", tone: "no", name: "Very likely unrecoverable", note: "Be wary of recovery offers" },
  { level: "unknown", mark: "?", tone: "unknown", name: "Unknown", note: "Send a small test" },
  { level: "not-applicable", mark: "•", tone: "unknown", name: "Not a smart wallet", note: "A key address, already yours" },
];

// Every verdict level recover() / page.js can emit. The wheel renders a gate per level, so each must have a GATE above.
export const LEVELS = ["yes-with-risk", "danger", "likely-no", "unknown", "not-applicable"];

/** The gate (answer) a verdict level belongs to, or undefined if none. Pure. */
export const gateFor = (level) => GATES.find((g) => g.level === level);
