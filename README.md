# 🚀 Vault.fm – Premium Cyberpunk Cross-Chain Memory Vault

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=Vite&logoColor=white)](https://vitejs.dev/)
[![Ethers](https://img.shields.io/badge/Ethers.js-000000?style=for-the-badge&logo=Ethereum&logoColor=white)](https://docs.ethers.org/v6/)
[![Privy](https://img.shields.io/badge/Privy-8b5cf6?style=for-the-badge&logo=auth0&logoColor=white)](https://privy.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Vault.fm is a premium, retro-cyberpunk decentralized application (dApp) built to empower **Bags.fm** creators and fans. It lets users preserve milestones and core digital memories as **100% on-chain NFTs** with zero onboarding friction, live creator token statistics, and automated gasless paymaster sponsorships.

---

## 🗺️ System Architecture

Vault.fm is engineered with a modular Web3 architecture combining dynamic SDK hooks, API relays, client-side canvas compression, and platform-sponsored transactions:

```mermaid
flowchart TD
    %% Styling
    classDef main fill:#1a102f,stroke:#b450ff,stroke-width:2px,color:#fff;
    classDef contract fill:#0d261b,stroke:#00ff78,stroke-width:2px,color:#fff;
    classDef external fill:#281c1c,stroke:#ff3b30,stroke-width:2px,color:#fff;

    %% Nodes
    User([Fan / Creator]):::main
    UI["Vault.fm Web Portal (Vite/Vanilla JS)"]:::main
    Canvas["HTML5 Canvas Compression Engine"]:::main
    BagsAPI["Bags.fm API Client"]:::external
    Privy["Privy Embedded Wallet (Email OTP)"]:::external
    MetaMask["MetaMask Browser Extension"]:::external
    Sponsor["Paymaster Relayer Wallet"]:::main
    Contract["MemoryNFT.sol (Sepolia)"]:::contract
    BAGS["Bags Token Contract ($BAGS ERC-20)"]:::contract

    %% Connections
    User -->|Logs In| UI
    UI -->|1-Click Email Auth| Privy
    UI -->|Traditional Connect| MetaMask
    UI -->|Searches Creator| BagsAPI
    BagsAPI -->|Live Price, Volume, Holders| UI
    
    User -->|Fills Form & Uploads Image| Canvas
    Canvas -->|Downscales & Compresses Image| Canvas
    Canvas -->|Outputs Optimized Data URL| UI
    
    UI -->|Queries $BAGS Balance| BAGS
    BAGS -->|Waives Fee if >= 10 $BAGS| UI
    
    UI -->|Requests Transaction| MintFlow{Gasless Mint Checked?}:::main
    MintFlow -->|Yes (Sponsorship)| Sponsor
    MintFlow -->|No| Contract
    
    Sponsor -->|Signs & Pays Sepolia Gas| Contract
    Contract -->|Mints 100% On-Chain BVM NFT| User
```

---

## ✨ Key Features

### 1. Hybrid Onboarding & Authentication
* **Privy Embedded Wallet:** Users can sign up in under 10 seconds using just their email and a 6-digit one-time passcode (OTP). Privy securely spins up an embedded, self-custodial EVM wallet in the background—requiring **zero browser extensions**.
* **Traditional MetaMask Connection:** Power-users can immediately link external wallets.
* **Seamless Hot-Swapping:** A unified authentication panel dynamically manages active sessions, letting users switch between Privy and MetaMask instantly.

### 2. Frictionless Paymaster Relayer (Gasless Minting)
* **Zero ETH Required:** Brand new users with `0 ETH` can mint immediately. When the **"Gasless Mint"** option is toggled, the dApp routes transaction signing and execution through a platform-funded Relayer wallet (`sponsorWallet`).
* **Waiver Loophole:** Because the platform Relayer address holds **999,900 $BAGS**, any sponsored transaction automatically bypasses the 0.0001 ETH contract fee on the `MemoryNFT` contract—providing a completely **100% free, 1-click on-chain minting experience**.

### 3. Live Bags.fm Creator Dashboard
* **Dynamic API Integration:** Input any Bags.fm username (e.g. `@satoshi`, `@vitalik`) and watch a neon glassmorphic statistics grid instantly query live market metrics (Token Price, 24h Volume, and Active Holders) directly from the Bags.fm developers API.
* **Creator CTA:** Provides a direct purchase action button redirection to buy the creator's tokens on Bags.fm.

### 4. Client-Side HTML5 Canvas Compression Engine
* **Metadata Efficiency:** All NFT metadata and images are stored **100% on-chain** (no IPFS or centralized server dependencies).
* **Network Cost Reduction:** Image uploads are intercepted, automatically downscaled to `120x120px`, and converted to compressed JPEG data URLs. This **reduces contract deployment and execution fees by over 30%** (slashing network fees to a minuscule `~0.013 Sepolia ETH` per mint).

---

## 🛠️ Developer Setup & Local Run

Follow these instructions to launch Vault.fm on your local machine:

### 1. Clone the Repository & Install Dependencies
Ensure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
# Install NPM dependencies
npm install
```

### 2. Configure Environment Variables
Create a `.env` file at the root of the project (or modify the existing one) with your credentials:
```env
# 1️⃣ Your wallet's private key (funding account)
PRIVATE_KEY=your_private_key_here

# 2️⃣ Gasless Paymaster Relayer Private Key
# (Needs Sepolia ETH for gas and 10+ $BAGS tokens to waive fees)
VITE_SPONSOR_PRIVATE_KEY=your_sponsor_private_key_here

# 3️⃣ Privy Developer API Credentials
# Create a free account at https://dashboard.privy.io/
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_PRIVY_CLIENT_ID=your_privy_client_id

# 4️⃣ Sepolia RPC Endpoint
VITE_SEPOLIA_RPC_URL=https://sepolia.drpc.org
```

### 3. Spin up the Development Server
```bash
# Run local Vite server
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser to experience Vault.fm!

---

## ⚡ 1-Click Deployment

Deploy Vault.fm instantly to Vercel or Netlify with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmerezki-11%2FUniperforma)
&nbsp;&nbsp;
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/merezki-11/Uniperforma)

---

## 📝 Smart Contract Deployments (Sepolia Testnet)

* **BagsCreatorToken ($BAGS ERC-20):** [`0x2774C374A7C15C1e2DE792cfc9EC9378C62d1844`](https://sepolia.etherscan.io/address/0x2774C374A7C15C1e2DE792cfc9EC9378C62d1844)
* **MemoryNFT (ERC-721 Vault):** [`0x3F6f9Edc4A39a05D97F64B77Abc01c1E0637F1aE`](https://sepolia.etherscan.io/address/0x3F6f9Edc4A39a05D97F64B77Abc01c1E0637F1aE)
* **Platform Relayer Wallet:** `0xC0363Deeb403FDFE63cB15B90261a6a985beCe34`

---

## 📜 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
