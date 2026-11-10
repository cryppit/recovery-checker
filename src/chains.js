// The EVM chains a check reads. Public RPCs only, no keys, each answering browsers (CORS); checked with eth_chainId on
// 26 Oct 2026 and, for the chains from Polygon on, 6 Nov 2026. Each list is tried in order. dRPC and 1RPC are never used.
// Kaia is left out on purpose: an account there can change its key, so "a key works on every chain" would not hold.
export const CHAINS = [
  { id: 1, name: "Ethereum", logo: "ethereum", rpcs: ["https://ethereum-rpc.publicnode.com", "https://rpc.mevblocker.io"], explorer: "https://etherscan.io/address/" },
  { id: 56, name: "BNB Chain", logo: "binance-smart-chain", rpcs: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org"], explorer: "https://bscscan.com/address/" },
  { id: 8453, name: "Base", logo: "base", rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"], explorer: "https://basescan.org/address/" },
  { id: 42161, name: "Arbitrum One", logo: "arbitrum-one", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"], explorer: "https://arbiscan.io/address/" },
  { id: 10, name: "OP Mainnet", logo: "optimism", rpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"], explorer: "https://optimistic.etherscan.io/address/" },
  { id: 43114, name: "Avalanche C-Chain", logo: "avalanche", rpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"], explorer: "https://snowtrace.io/address/" },
  { id: 59144, name: "Linea", logo: "linea", rpcs: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"], explorer: "https://lineascan.build/address/" },
  { id: 324, name: "ZKsync Era", logo: "zksync", rpcs: ["https://mainnet.era.zksync.io"], explorer: "https://explorer.zksync.io/address/" },
  { id: 534352, name: "Scroll", logo: "scroll", rpcs: ["https://rpc.scroll.io", "https://scroll-rpc.publicnode.com"], explorer: "https://scrollscan.com/address/" },
  { id: 100, name: "Gnosis", logo: "gnosis", rpcs: ["https://rpc.gnosischain.com", "https://gnosis-rpc.publicnode.com"], explorer: "https://gnosisscan.io/address/" },
  { id: 130, name: "Unichain", logo: "unichain", rpcs: ["https://mainnet.unichain.org", "https://unichain-rpc.publicnode.com"], explorer: "https://uniscan.xyz/address/" },
  { id: 4663, name: "Robinhood Chain", logo: "robinhood", rpcs: ["https://rpc.mainnet.chain.robinhood.com"], explorer: "https://robinhoodchain.blockscout.com/address/" },
  // Abstract shuts down on 15 Dec 2026; after that the archive in data/abstract/ answers for it.
  { id: 2741, name: "Abstract", logo: "abstract", rpcs: ["https://api.mainnet.abs.xyz"], explorer: "https://abscan.org/address/", until: "2026-12-15" },
  { id: 146, name: "Sonic", logo: "sonic", rpcs: ["https://rpc.soniclabs.com", "https://sonic-rpc.publicnode.com"], explorer: "https://sonicscan.org/address/" },
  { id: 42220, name: "Celo", logo: "celo", rpcs: ["https://forno.celo.org", "https://celo-rpc.publicnode.com"], explorer: "https://celoscan.io/address/" },
  { id: 5000, name: "Mantle", logo: "mantle", rpcs: ["https://rpc.mantle.xyz", "https://mantle-rpc.publicnode.com"], explorer: "https://mantlescan.xyz/address/" },
  { id: 81457, name: "Blast", logo: "blast", rpcs: ["https://rpc.blast.io", "https://blast-rpc.publicnode.com"], explorer: "https://blastscan.io/address/" },
  { id: 80094, name: "Berachain", logo: "berachain", rpcs: ["https://rpc.berachain.com", "https://berachain-rpc.publicnode.com"], explorer: "https://berascan.com/address/" },
  { id: 999, name: "HyperEVM", logo: "hyper-evm", rpcs: ["https://rpc.hyperliquid.xyz/evm"], explorer: "https://hyperevmscan.io/address/" },
  { id: 57073, name: "Ink", logo: "ink", rpcs: ["https://rpc-gel.inkonchain.com", "https://ink-rpc.publicnode.com"], explorer: "https://explorer.inkonchain.com/address/" },
  { id: 137, name: "Polygon", logo: "polygon", rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.gateway.tenderly.co"], explorer: "https://polygonscan.com/address/" },
  { id: 25, name: "Cronos", logo: "cronos", rpcs: ["https://evm.cronos.org", "https://cronos-evm-rpc.publicnode.com"], explorer: "https://explorer.cronos.org/address/" },
  { id: 1329, name: "Sei", logo: "sei-network", rpcs: ["https://evm-rpc.sei-apis.com", "https://sei-evm-rpc.publicnode.com"], explorer: "https://seitrace.com/address/" },
  { id: 167000, name: "Taiko", logo: "taiko", rpcs: ["https://rpc.mainnet.taiko.xyz", "https://taiko-rpc.publicnode.com"], explorer: "https://taikoscan.io/address/" },
  { id: 1088, name: "Metis", logo: "metis-andromeda", rpcs: ["https://andromeda.metis.io/?owner=1088", "https://metis-rpc.publicnode.com"], explorer: "https://andromeda-explorer.metis.io/address/" },
  { id: 143, name: "Monad", logo: "monad", rpcs: ["https://rpc.monad.xyz"], explorer: "https://monadscan.com/address/" },
  { id: 9745, name: "Plasma", logo: "plasma", rpcs: ["https://rpc.plasma.to"], explorer: "https://plasmascan.to/address/" },
  { id: 747474, name: "Katana", logo: "katana", rpcs: ["https://rpc.katana.network"], explorer: "https://katanascan.com/address/" },
  { id: 1868, name: "Soneium", logo: "soneium", rpcs: ["https://rpc.soneium.org"], explorer: "https://soneium.blockscout.com/address/" },
  { id: 7777777, name: "Zora", logo: "zora", rpcs: ["https://rpc.zora.energy"], explorer: "https://explorer.zora.energy/address/" },
  { id: 34443, name: "Mode", logo: "mode", rpcs: ["https://mainnet.mode.network"], explorer: "https://explorer.mode.network/address/" },
  { id: 1135, name: "Lisk", logo: "lisk", rpcs: ["https://rpc.api.lisk.com"], explorer: "https://blockscout.lisk.com/address/" },
];

// Networks a check knows by address format. Each id is a chain in addresses.js. Those with `reads` are also asked one
// thing, whether an account wants a tag or a memo (ledgers.js); the rest are never contacted.
export const NETWORKS = [
  { id: "bitcoin", name: "Bitcoin", logo: "bitcoin" },
  { id: "solana", name: "Solana", logo: "solana" },
  { id: "tron", name: "TRON", logo: "tron" },
  { id: "ton", name: "TON", logo: "ton" },
  { id: "xrp", name: "XRP", logo: "xrp", reads: "XRP Ledger" },
  { id: "near", name: "NEAR", logo: "near-protocol" },
  { id: "zcash", name: "Zcash", logo: "token-zec" },
  { id: "litecoin", name: "Litecoin", logo: "litecoin" },
  { id: "dogecoin", name: "Dogecoin", logo: "token-doge" },
  { id: "bitcoincash", name: "Bitcoin Cash", logo: "token-bch" },
  { id: "dash", name: "Dash", logo: "token-dash" },
  { id: "stellar", name: "Stellar", logo: "stellar", reads: "Stellar network" },
  { id: "cardano", name: "Cardano", logo: "cardano" },
  { id: "sui", name: "Sui", logo: "sui" },
  { id: "aptos", name: "Aptos", logo: "aptos" },
  { id: "starknet", name: "Starknet", logo: "starknet" },
  { id: "movement", name: "Movement", logo: "movement" },
  { id: "aleo", name: "Aleo", logo: "token-aleo" },
  { id: "fogo", name: "Fogo", logo: "token-fogo" },
];

const byId = new Map(CHAINS.map((c) => [c.id, c]));
export const chainName = (id) => byId.get(id)?.name ?? NETWORKS.find((n) => n.id === id)?.name ?? `chain ${id}`;
export const chainById = (id) => byId.get(id);
const networkIds = new Map(NETWORKS.map((n) => [n.id, n]));
export const networkById = (id) => networkIds.get(id);
/** A chain read live, or a network known by format only. */
export const targetById = (id) => byId.get(id) ?? networkIds.get(id);
