// src/contract.js

// 1️⃣ MemoryNFT (Bags Vault Memory) Contract Config
export const CONTRACT_ADDRESS = "0x3F6f9Edc4A39a05D97F64B77Abc01c1E0637F1aE";

export const CONTRACT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function bagsToken() view returns (address)",
  "function MINT_FEE() view returns (uint256)",
  "function FREE_MINT_THRESHOLD() view returns (uint256)",
  "function mint(address to, string memory tokenURI) public payable returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event FeeSplit(address indexed creator, address indexed platform, uint256 creatorShare, uint256 platformShare)"
];

// 2️⃣ BagsCreatorToken Contract Config
export const BAGS_TOKEN_ADDRESS = "0xEC6d6b07Ba42dD360740a12Bf8de974cA0AC3B6B";

export const BAGS_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)"
];
