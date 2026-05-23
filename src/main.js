// src/main.js
// ------------------------------------------------------------
// Vault.fm main entry point – wallet connection, Bags.fm API integration, on-chain base64 metadata, NFT minting & timeline rendering
// ------------------------------------------------------------

import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, BAGS_TOKEN_ADDRESS, BAGS_TOKEN_ABI } from "./contract.js";
import { getCreatorTokenMetrics } from "./bagsApi.js";
import { initPrivy, sendOtp, verifyOtp, getPrivySigner, getPrivyUser, privyLogout, showPrivyIframe, hidePrivyIframe } from "./privyAuth.js";

// ---------- UI Elements ----------
const connectBtn = document.getElementById("connectBtn");
const walletInfo = document.getElementById("walletInfo");
const addressSpan = document.getElementById("address");
const mintForm = document.getElementById("mint-form");
const bagsUsernameInput = document.getElementById("bagsUsernameInput");
const fileInput = document.getElementById("fileInput");
const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const timelineEl = document.getElementById("timeline");

// Live Bags Dashboard Elements
const creatorStats = document.getElementById("creatorStats");
const statPrice = document.getElementById("statPrice");
const statVolume = document.getElementById("statVolume");
const statHolders = document.getElementById("statHolders");
const buyTokenBtn = document.getElementById("buyTokenBtn");

// Unified Auth Panel Elements
const authContainer = document.getElementById("authContainer");
const loginForm = document.getElementById("loginForm");
const otpForm = document.getElementById("otpForm");
const emailInput = document.getElementById("emailInput");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const otpInput = document.getElementById("otpInput");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const backToLoginBtn = document.getElementById("backToLoginBtn");
const sentEmailSpan = document.getElementById("sentEmailSpan");

let provider;
let signer;
let userAddress;
let statsInterval = null;
let currentTokenUrl = "";
let isPrivy = false;

// ---------- Gasless Relayer Sponsor Config ----------
const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://sepolia.drpc.org";
const SPONSOR_PRIVATE_KEY = import.meta.env.VITE_SPONSOR_PRIVATE_KEY;

let sponsorWallet = null;
if (SPONSOR_PRIVATE_KEY) {
  try {
    const rpcProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    sponsorWallet = new ethers.Wallet(SPONSOR_PRIVATE_KEY, rpcProvider);
    console.log("[Gasless Sponsor] Paymaster Relayer successfully initialized:", sponsorWallet.address);
  } catch (err) {
    console.warn("[Gasless Sponsor] Failed to initialize sponsor wallet:", err);
  }
}

const sponsorGasCheckbox = document.getElementById("sponsorGasCheckbox");
const sponsorToggleGroup = document.getElementById("sponsorToggleGroup");

// Make address copyable
if (addressSpan) {
  addressSpan.style.cursor = "pointer";
  addressSpan.style.transition = "color 0.2s ease, text-shadow 0.2s ease";
  addressSpan.title = "Click to copy full address";
  addressSpan.addEventListener("click", async () => {
    if (userAddress) {
      try {
        await navigator.clipboard.writeText(userAddress);
        addressSpan.textContent = "Copied! ✨";
        addressSpan.style.color = "var(--accent-magenta)";
        addressSpan.style.textShadow = "0 0 8px rgba(255, 80, 220, 0.5)";
        setTimeout(() => {
          addressSpan.textContent = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
          addressSpan.style.color = "";
          addressSpan.style.textShadow = "";
        }, 1200);
      } catch (err) {
        console.warn("Failed to copy address:", err);
      }
    }
  });
}


// ---------- Helper: Custom Modal Popup ----------
function showCustomModal({ title, icon, bodyHTML, primaryText = "OK", primaryCallback = null }) {
  let modalOverlay = document.getElementById("customModal");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "customModal";
    modalOverlay.className = "modal-overlay";
    modalOverlay.innerHTML = `
      <div class="modal-content">
        <button id="closeModalBtn" class="close-btn">&times;</button>
        <div id="modalIcon" class="modal-icon">⚠️</div>
        <h3 id="modalTitle">Alert</h3>
        <div id="modalBody" class="modal-body"></div>
        <div class="modal-actions" id="modalActions">
          <button id="modalPrimaryBtn" class="modal-primary-btn">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  const modalIcon = document.getElementById("modalIcon");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalPrimaryBtn = document.getElementById("modalPrimaryBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");

  modalIcon.textContent = icon || "⚠️";
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalPrimaryBtn.textContent = primaryText;

  modalOverlay.style.display = "flex";

  const close = () => {
    modalOverlay.style.display = "none";
  };

  closeModalBtn.onclick = close;
  modalPrimaryBtn.onclick = () => {
    close();
    if (primaryCallback) primaryCallback();
  };

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) {
      close();
    }
  };
}

// ---------- Helper: Convert File to Base64 Data URL ----------
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Helper: Compress Image dynamically using HTML5 Canvas ----------
function compressImage(file, maxWidth = 128, maxHeight = 128, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to highly-compressed JPEG data URL
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}


// ---------- File Selection Feedback ----------
const fileLabel = document.querySelector(".file-label");
if (fileInput && fileLabel) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      const filename = fileInput.files[0].name;
      fileLabel.innerHTML = `✅ ${filename} Selected`;
      fileLabel.style.borderColor = "var(--accent-magenta)";
      fileLabel.style.color = "var(--accent-magenta)";
      fileLabel.style.background = "rgba(255, 80, 220, 0.08)";
    } else {
      fileLabel.innerHTML = "📸 Upload Memory Image";
      fileLabel.style.borderColor = "";
      fileLabel.style.color = "";
      fileLabel.style.background = "";
    }
  });
}

// ---------- Wallet connection ----------
async function connectWallet() {
  if (!window.ethereum) {
    showCustomModal({
      title: "MetaMask Required",
      icon: "🦊",
      bodyHTML: `
        <p>MetaMask was not detected in your browser.</p>
        <p>Please install the <a href="https://metamask.io/" target="_blank">MetaMask Extension</a> or open this page inside a Web3-enabled browser to connect your wallet and access Vault.fm.</p>
      `,
      primaryText: "Get MetaMask",
      primaryCallback: () => {
        window.open("https://metamask.io/", "_blank");
      }
    });
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    isPrivy = false;

    // UI updates
    authContainer.style.display = "none";
    walletInfo.style.display = "flex";
    addressSpan.textContent = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
    mintForm.style.display = "flex";
    if (sponsorWallet && sponsorToggleGroup) {
      sponsorToggleGroup.style.display = "flex";
    }

    // Update fee status based on real on-chain $BAGS balance
    await updateFeeBadge();

    // Load existing NFTs for this address
    await loadTimeline();
    
    // Listen for account change to update UI
    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts.length > 0) {
        userAddress = ethers.getAddress(accounts[0]);
        signer = await provider.getSigner();
        addressSpan.textContent = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        await updateFeeBadge();
        await loadTimeline();
      } else {
        location.reload();
      }
    });

  } catch (err) {
    console.error("Wallet connection failed:", err);
    showCustomModal({
      title: "Connection Failed",
      icon: "🔌",
      bodyHTML: `
        <p>Failed to establish connection with your MetaMask wallet.</p>
        <div style="background: rgba(255, 0, 100, 0.05); padding: 0.8rem; border-radius: 0.6rem; border: 1px solid rgba(255, 0, 100, 0.15); margin: 1rem 0; font-family: monospace; font-size: 0.85rem; color: hsl(0, 85%, 70%); word-break: break-word; text-align: left;">
          ${err.message || err}
        </div>
        <p>Please unlock MetaMask, make sure you approve the connection request, and try again.</p>
      `,
      primaryText: "Dismiss"
    });
  }
}

// ---------- Update Fee Badge dynamically based on token balance ----------
async function updateFeeBadge() {
  const feeBadge = walletInfo.querySelector(".fee-badge");
  if (!provider || !userAddress) {
    console.warn("[updateFeeBadge] Skipped: provider or userAddress missing", { provider: !!provider, userAddress });
    return;
  }

  console.log("[updateFeeBadge] Starting balance check for:", userAddress);

  try {
    // Check what network the wallet provider is actually on
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log("[updateFeeBadge] Wallet provider chainId:", chainId, "name:", network.name);

    if (chainId !== 11155111) {
      feeBadge.className = "fee-badge status-fee-required";
      const walletName = isPrivy ? "your Privy embedded wallet" : "MetaMask";
      feeBadge.innerHTML = `⚠️ <strong>Network Mismatch (chain ${chainId}):</strong> Please switch ${walletName} to the <strong>Sepolia Test Network</strong>.`;
      console.error("[updateFeeBadge] WRONG CHAIN:", chainId, "- expected 11155111 (Sepolia)");
      return;
    }

    // Use the wallet's own provider for queries (it routes through Privy's RPC infra, no CORS issues)
    const tokenContract = new ethers.Contract(BAGS_TOKEN_ADDRESS, BAGS_TOKEN_ABI, provider);
    const nftContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log("[updateFeeBadge] Querying balanceOf for:", userAddress, "on token:", BAGS_TOKEN_ADDRESS);
    const balanceWei = await tokenContract.balanceOf(userAddress);
    console.log("[updateFeeBadge] Raw balanceWei:", balanceWei.toString());

    const decimals = await tokenContract.decimals();
    console.log("[updateFeeBadge] Token decimals:", Number(decimals));

    const balance = Number(ethers.formatUnits(balanceWei, decimals));
    console.log("[updateFeeBadge] Formatted balance:", balance);

    const thresholdWei = await nftContract.FREE_MINT_THRESHOLD();
    const threshold = Number(ethers.formatUnits(thresholdWei, decimals));
    console.log("[updateFeeBadge] Free mint threshold:", threshold);

    if (balance >= threshold) {
      feeBadge.className = "fee-badge status-free";
      feeBadge.innerHTML = `💎 Deeper Integration Active: You hold ${balance.toLocaleString()} $BAGS (Threshold >= ${threshold}). <strong>Mint Fee WAIVED (100% Free!)</strong>`;
      console.log("[updateFeeBadge] ✅ Fee WAIVED");
      if (sponsorDesc) {
        sponsorDesc.innerHTML = `⚡ Gas Sponsor Active: You hold enough $BAGS to waive the mint fee! Vault.fm will sponsor your network gas. (100% Free)`;
      }
    } else {
      feeBadge.className = "fee-badge status-fee-required";
      feeBadge.innerHTML = `🪙 You hold ${balance.toLocaleString()} $BAGS (under ${threshold}). <strong>Mint Fee: 0.0001 ETH</strong> (90% Creator / 10% Bags Pool Split)`;
      console.log("[updateFeeBadge] ⚠️ Fee required");
      if (sponsorDesc) {
        sponsorDesc.innerHTML = `⚡ Gas Sponsor Active: Both the 0.0001 ETH Mint Fee and Network Gas are fully sponsored! (100% Free)`;
      }
    }
  } catch (err) {
    console.error("[updateFeeBadge] FAILED:", err.message);
    feeBadge.innerHTML = `⚠️ Balance check failed: ${err.message}`;
  }
}

// ---------- Live Bags.fm API Stats Dashboard ----------
let statsDebounceTimeout;
bagsUsernameInput.addEventListener("input", () => {
  clearTimeout(statsDebounceTimeout);
  
  const username = bagsUsernameInput.value.trim();
  if (username.length > 2) {
    // Debounce to prevent hitting the API too rapidly on every keystroke
    statsDebounceTimeout = setTimeout(() => {
      startLiveStatsFeed(username);
    }, 500);
  } else {
    // Hide stats dashboard if input is cleared
    creatorStats.style.display = "none";
    clearInterval(statsInterval);
  }
});

async function startLiveStatsFeed(username) {
  clearInterval(statsInterval);
  
  // Initial fetch
  await fetchAndRenderStats(username);

  // Poll the API/simulated feed every 6 seconds to show real-time market fluctuations!
  statsInterval = setInterval(async () => {
    await fetchAndRenderStats(username);
  }, 6000);
}

async function fetchAndRenderStats(username) {
  try {
    const metrics = await getCreatorTokenMetrics(username);
    
    // Show stats board
    creatorStats.style.display = "grid";
    
    // Populate stats with clean fades
    statPrice.textContent = metrics.price;
    statVolume.textContent = metrics.volume24h;
    statHolders.textContent = metrics.holders.toLocaleString();
    
    // Update Action Button
    buyTokenBtn.textContent = `Buy $${username.replace("@", "").toUpperCase()} on Bags.fm`;
    currentTokenUrl = metrics.tokenUrl;
  } catch (err) {
    console.error("Failed to load creator stats:", err);
  }
}

connectBtn.addEventListener("click", connectWallet);
buyTokenBtn.addEventListener("click", () => {
  if (currentTokenUrl) {
    window.open(currentTokenUrl, "_blank");
  }
});

// ---------- Mint NFT ----------
mintForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let iframeTimeout = null;
  if (!signer) {
    showCustomModal({
      title: "Authentication Required",
      icon: "🔌",
      bodyHTML: "<p>Please log in with your email or connect a wallet before trying to mint creator memories.</p>",
      primaryText: "Go to Login",
      primaryCallback: () => {
        authContainer.scrollIntoView({ behavior: "smooth" });
      }
    });
    return;
  }

  const bagsUsername = bagsUsernameInput.value.trim();
  const file = fileInput.files[0];
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!bagsUsername || !file || !title || !description) {
    showCustomModal({
      title: "Incomplete Fields",
      icon: "📝",
      bodyHTML: "<p>All fields are required to mint a memory vault. Please specify username, title, description, and upload a milestone image.</p>",
      primaryText: "Review Form"
    });
    return;
  }

  const isSponsorshipActive = sponsorGasCheckbox && sponsorGasCheckbox.checked && sponsorWallet;

  // Pre-flight check: read ETH balance to avoid MetaMask revert on 0 ETH
  if (!isSponsorshipActive) {
    let balanceETH = 0n;
    try {
      balanceETH = await provider.getBalance(userAddress);
    } catch (balErr) {
      console.warn("Could not check pre-flight ETH balance:", balErr);
    }

    if (balanceETH === 0n) {
      showCustomModal({
        title: "Sepolia ETH Required",
        icon: "🪙",
        bodyHTML: `
          <p>Your connected wallet has <strong>0 Sepolia ETH</strong>. To mint a memory to the blockchain, you need a small amount of test ETH to cover network gas fees.</p>
          <p>Even though your mint fee is waived because of your $BAGS token holding, the Sepolia network still requires gas to record your digital vault memory on-chain.</p>
          <div style="background: rgba(255,255,255,0.04); padding: 0.8rem; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.08); margin: 1rem 0;">
            <p style="margin:0 0 0.3rem 0; font-size:0.85rem; color:var(--text-secondary)">Your Connected Wallet:</p>
            <p style="margin:0 0 0.8rem 0; font-family:monospace; font-size:0.95rem; color:var(--accent-magenta); overflow-wrap: break-word; word-break: break-all;">${userAddress}</p>
            <p style="margin:0 0 0.3rem 0; font-size:0.85rem; color:var(--text-secondary)">Current ETH Balance:</p>
            <p style="margin:0; font-size:1.1rem; font-weight:bold; color:#fff;">0.00000 Sepolia ETH</p>
          </div>
          <p><strong>How to get free Sepolia ETH:</strong></p>
          <ul style="margin:0 0 1rem 0; padding-left:1.2rem; font-size:0.9rem; color:var(--text-secondary);">
            <li>Copy your wallet address above.</li>
            <li>Visit one of these reputable Sepolia Faucets to claim free test ETH:
              <ul style="margin:0.25rem 0 0 0; padding-left:1rem;">
                <li><a href="https://sepoliafaucet.com/" target="_blank">sepoliafaucet.com (Alchemy)</a></li>
                <li><a href="https://faucet.quicknode.com/drip" target="_blank">faucet.quicknode.com (QuickNode)</a></li>
                <li><a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank">cloud.google.com Faucet</a></li>
              </ul>
            </li>
            <li>Request the tokens into your wallet, then click "Mint to Vault.fm" again!</li>
          </ul>
        `,
        primaryText: "Got It"
      });
      return;
    }
  }

  // Show visual loading state on submit button
  const submitBtn = mintForm.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Storing On-Chain...";

  try {
    // 1️⃣ Compress the image to fit on-chain gas limits
    submitBtn.textContent = "Optimizing Image...";
    const imageBase64 = await compressImage(file, 120, 120, 0.5);


    // 2️⃣ Build 100% on-chain metadata URI (Data URL) matching Bags schema
    const metadata = {
      name: title,
      description: description,
      image: imageBase64,
      properties: {
        creator: bagsUsername,
        platform: "Bags.fm"
      }
    };
    const jsonString = JSON.stringify(metadata);
    // Base64 encode JSON securely supporting unicode characters
    const tokenURI = "data:application/json;base64," + btoa(unescape(encodeURIComponent(jsonString)));

    // 3️⃣ Verify fee status and execute transaction (use wallet provider for reads, signer for writes)
    const tokenContract = new ethers.Contract(BAGS_TOKEN_ADDRESS, BAGS_TOKEN_ABI, provider);
    const nftContractRead = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const nftContractWrite = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const balanceWei = await tokenContract.balanceOf(userAddress);
    const thresholdWei = await nftContractRead.FREE_MINT_THRESHOLD();
    const mintFeeWei = await nftContractRead.MINT_FEE();

    let tx;


    if (isSponsorshipActive) {
      submitBtn.textContent = "Sponsoring Gas Fees...";
      console.log("[Sponsor] Submitting sponsored transaction from Relayer:", sponsorWallet.address);
      const nftContractSponsorWrite = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, sponsorWallet);
      
      // Submit sponsored transaction (fee is waived because Sponsor holds 999,900 $BAGS)
      tx = await nftContractSponsorWrite.mint(userAddress, tokenURI, { value: 0 });
    } else {
      if (isPrivy) {
        // Delay showing the iframe modal by 400ms. If the transaction signs instantly (headless mode),
        // the finally block will cancel this timeout and the iframe will never flash on screen.
        iframeTimeout = setTimeout(() => {
          showPrivyIframe();
        }, 400);
      }

      if (balanceWei >= thresholdWei) {
        // Fee waived
        tx = await nftContractWrite.mint(userAddress, tokenURI, { value: 0 });
      } else {
        // Fee required
        tx = await nftContractWrite.mint(userAddress, tokenURI, { value: mintFeeWei });
      }
    }
    
    submitBtn.textContent = "Waiting for block confirmation...";
    await tx.wait();

    // Reset form
    mintForm.reset();
    if (fileLabel) {
      fileLabel.innerHTML = "📸 Upload Memory Image";
      fileLabel.style.borderColor = "";
      fileLabel.style.color = "";
      fileLabel.style.background = "";
    }

    showCustomModal({
      title: "Memory Minted!",
      icon: "🎉",
      bodyHTML: `
        <p>Congratulations! Your creator milestone memory has been successfully recorded 100% on-chain on the Sepolia network.</p>
        <p>It is now permanently linked to the Bags.fm creator profile for <strong>${bagsUsername}</strong>.</p>
      `,
      primaryText: "Fantastic"
    });
    
    // Refresh timeline, stats feed, and fee badge
    await updateFeeBadge();
    await loadTimeline();
  } catch (err) {
    console.error("Minting error details:", err);
    
    // Check if the error is related to gas estimation or Sepolia ETH shortage
    const errString = err.message || "";
    const isGasEstimateFailure = errString.includes("estimateGas") || errString.includes("revert") || errString.includes("missing revert data");
    
    let currentBalanceETH = 0;
    try {
      const balWei = await provider.getBalance(userAddress);
      currentBalanceETH = Number(ethers.formatEther(balWei));
    } catch (balErr) {
      console.warn("Could check ETH balance in catch:", balErr);
    }

    if (!isSponsorshipActive && currentBalanceETH < 0.002 && isGasEstimateFailure) {
      showCustomModal({
        title: "Sepolia ETH Required",
        icon: "🪙",
        bodyHTML: `
          <p>Your transaction failed because your connected account does not have enough <strong>Sepolia ETH</strong> to cover transaction gas fees.</p>
          <p>Even though the $BAGS holder mint fee is waived, the Sepolia network still requires gas to record your digital vault memory on-chain.</p>
          <div style="background: rgba(255,255,255,0.04); padding: 0.8rem; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.08); margin: 1rem 0;">
            <p style="margin:0 0 0.3rem 0; font-size:0.85rem; color:var(--text-secondary)">Your Connected Wallet:</p>
            <p style="margin:0 0 0.8rem 0; font-family:monospace; font-size:0.95rem; color:var(--accent-magenta); overflow-wrap: break-word; word-break: break-all;">${userAddress}</p>
            <p style="margin:0 0 0.3rem 0; font-size:0.85rem; color:var(--text-secondary)">Current ETH Balance:</p>
            <p style="margin:0; font-size:1.1rem; font-weight:bold; color:#fff;">${currentBalanceETH.toFixed(5)} Sepolia ETH</p>
          </div>
          <p><strong>How to get free Sepolia ETH:</strong></p>
          <ul style="margin:0 0 1rem 0; padding-left:1.2rem; font-size:0.9rem; color:var(--text-secondary);">
            <li>Copy your wallet address above.</li>
            <li>Visit one of these reputable Sepolia Faucets to claim free test ETH:
              <ul style="margin:0.25rem 0 0 0; padding-left:1rem;">
                <li><a href="https://sepoliafaucet.com/" target="_blank">sepoliafaucet.com (Alchemy)</a></li>
                <li><a href="https://faucet.quicknode.com/drip" target="_blank">faucet.quicknode.com (QuickNode)</a></li>
                <li><a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank">cloud.google.com Faucet</a></li>
              </ul>
            </li>
            <li>Request the tokens into your wallet, then click "Mint to Vault.fm" again!</li>
          </ul>
        `,
        primaryText: "Got It"
      });
    } else {
      showCustomModal({
        title: "Minting Failed",
        icon: "⚠️",
        bodyHTML: `
          <p>Something went wrong while attempting to mint your creator memory to the blockchain:</p>
          <div style="background: rgba(255, 0, 100, 0.05); padding: 0.8rem; border-radius: 0.6rem; border: 1px solid rgba(255, 0, 100, 0.15); margin: 1rem 0; font-family: monospace; font-size: 0.85rem; color: hsl(0, 85%, 70%); word-break: break-all; text-align: left; max-height: 120px; overflow-y: auto;">
            ${err.message || err}
          </div>
          <p>Please ensure your wallet is connected to the <strong>Sepolia Testnet</strong> and has enough ETH for gas.</p>
        `,
        primaryText: "Close"
      });
    }
  } finally {
    if (iframeTimeout) {
      clearTimeout(iframeTimeout);
    }
    if (isPrivy) {
      hidePrivyIframe();
    }
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// ---------- Load Timeline ----------
async function loadTimeline() {
  timelineEl.innerHTML = "<div class='loading-timeline'>Loading your Vault.fm memories...</div>";
  
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 11155111) {
      timelineEl.innerHTML = "<div class='error-timeline'>Wrong Network: Please switch to the Sepolia Test Network.</div>";
      return;
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    // Query Transfer events where recipient is the user within safe block range
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 45000);
    const filter = contract.filters.Transfer(null, userAddress);
    const events = await contract.queryFilter(filter, fromBlock, "latest");
    
    timelineEl.innerHTML = ""; // Clear loader

    if (events.length === 0) {
      timelineEl.innerHTML = "<div class='empty-timeline'>No memories saved in your Vault yet. Start by minting your first creator milestone above!</div>";
      return;
    }

    // Process events and render cards
    for (const event of events) {
      const tokenId = event.args.tokenId;
      
      try {
        // Double-check user still owns the token
        const currentOwner = await contract.ownerOf(tokenId);
        if (currentOwner.toLowerCase() !== userAddress.toLowerCase()) {
          continue; 
        }

        const uri = await contract.tokenURI(tokenId);
        let meta;

        // Check if metadata is base64 on-chain URI or external IPFS URI
        if (uri.startsWith("data:application/json;base64,")) {
          const base64Data = uri.split(",")[1];
          const decodedJson = decodeURIComponent(escape(atob(base64Data)));
          meta = JSON.parse(decodedJson);
        } else {
          // Fallback gateway fetch for standard IPFS URIs
          const gatewayURL = uri.replace(/^ipfs:\/\//, "https://dweb.link/ipfs/");
          const res = await fetch(gatewayURL);
          meta = await res.json();
        }

        if (meta && meta.image) {
          const creator = (meta.properties && meta.properties.creator) ? meta.properties.creator : "";
          addCard(meta.image, meta.name, meta.description, creator);
        }
      } catch (innerErr) {
        console.warn("Failed to process token:", tokenId.toString(), innerErr);
      }
    }
  } catch (err) {
    console.error("Error loading timeline:", err);
    timelineEl.innerHTML = "<div class='error-timeline'>Failed to load memories from the blockchain. Please verify your connection.</div>";
  }
}

function addCard(imageURI, title, description, creator) {
  const card = document.createElement("div");
  card.className = "card";
  
  const img = document.createElement("img");
  img.src = imageURI.startsWith("data:") ? imageURI : imageURI.replace(/^ipfs:\/\//, "https://dweb.link/ipfs/");
  img.alt = title;

  const info = document.createElement("div");
  info.className = "info";

  // Creator badge
  if (creator) {
    const creatorBadge = document.createElement("div");
    creatorBadge.className = "creator-badge";
    const cleanCreator = creator.startsWith("@") ? creator : "@" + creator;
    creatorBadge.textContent = cleanCreator;
    
    // Click action to view profile on Bags.fm
    creatorBadge.style.cursor = "pointer";
    creatorBadge.addEventListener("click", () => {
      window.open(`https://bags.fm/${cleanCreator.replace("@", "")}`, "_blank");
    });
    info.appendChild(creatorBadge);
  }
  
  const h3 = document.createElement("h3");
  h3.textContent = title;
  
  const p = document.createElement("p");
  p.textContent = description;
  
  info.appendChild(h3);
  info.appendChild(p);
  card.appendChild(img);
  card.appendChild(info);
  timelineEl.appendChild(card);
}

// ---------- Privy Event Listeners & Initialize ----------

sendOtpBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email || !email.includes("@")) {
    showCustomModal({
      title: "Invalid Email",
      icon: "📧",
      bodyHTML: "<p>Please enter a valid email address to receive your OTP passcode.</p>"
    });
    return;
  }
  
  const originalText = sendOtpBtn.textContent;
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = "Sending...";
  
  try {
    await sendOtp(email);
    sentEmailSpan.textContent = email;
    loginForm.style.display = "none";
    otpForm.style.display = "flex";
  } catch (err) {
    console.error("Failed to send OTP:", err);
    showCustomModal({
      title: "Error Sending OTP",
      icon: "⚠️",
      bodyHTML: `<p>Failed to send OTP to <strong>${email}</strong>.</p><p style="font-size:0.85rem; color:#ff6b6b;">${err.message || err}</p>`
    });
  } finally {
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = originalText;
  }
});

verifyOtpBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const code = otpInput.value.trim();
  if (code.length !== 6) {
    showCustomModal({
      title: "Invalid Passcode",
      icon: "🔑",
      bodyHTML: "<p>Please enter a valid 6-digit confirmation code.</p>"
    });
    return;
  }
  
  const originalText = verifyOtpBtn.textContent;
  verifyOtpBtn.disabled = true;
  verifyOtpBtn.textContent = "Verifying...";
  
  try {
    const { walletAddress } = await verifyOtp(email, code);
    isPrivy = true;
    userAddress = walletAddress;
    
    // Set up standard provider and signer wrapped bridge for embedded wallet
    signer = await getPrivySigner();
    provider = signer.provider;
    
    // UI updates
    authContainer.style.display = "none";
    walletInfo.style.display = "flex";
    addressSpan.textContent = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
    mintForm.style.display = "flex";
    if (sponsorWallet && sponsorToggleGroup) {
      sponsorToggleGroup.style.display = "flex";
    }
    
    await updateFeeBadge();
    await loadTimeline();
  } catch (err) {
    console.error("Failed to verify OTP:", err);
    showCustomModal({
      title: "Verification Failed",
      icon: "❌",
      bodyHTML: `<p>The OTP passcode you entered could not be verified.</p><p style="font-size:0.85rem; color:#ff6b6b;">${err.message || err}</p>`
    });
  } finally {
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.textContent = originalText;
  }
});

backToLoginBtn.addEventListener("click", () => {
  otpForm.style.display = "none";
  loginForm.style.display = "flex";
});

const disconnectBtn = document.getElementById("disconnectBtn");
if (disconnectBtn) {
  disconnectBtn.addEventListener("click", async () => {
    const originalText = disconnectBtn.textContent;
    disconnectBtn.disabled = true;
    disconnectBtn.textContent = "Disconnecting...";
    try {
      if (isPrivy) {
        await privyLogout();
      }
    } catch (err) {
      console.warn("Error during Privy logout:", err);
    }
    // Fully reset state and reload the page
    isPrivy = false;
    userAddress = null;
    signer = null;
    provider = null;
    location.reload();
  });
}

// Auto-Login Init Flow
async function initializeApp() {
  try {
    const privyUser = await getPrivyUser();
    if (privyUser && privyUser.walletAddress) {
      console.log("Restored active Privy session:", privyUser.walletAddress);
      isPrivy = true;
      userAddress = privyUser.walletAddress;
      
      signer = await getPrivySigner();
      provider = signer.provider;
      
      // UI updates
      authContainer.style.display = "none";
      walletInfo.style.display = "flex";
      addressSpan.textContent = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
      mintForm.style.display = "flex";
      if (sponsorWallet && sponsorToggleGroup) {
        sponsorToggleGroup.style.display = "flex";
      }
      
      await updateFeeBadge();
      await loadTimeline();
    } else {
      console.log("No active Privy session found.");
    }
  } catch (err) {
    console.warn("Failed to initialize Privy session:", err);
  }
}

// Call on startup
initializeApp();

// Auto-refresh the balance/fee badge in the background every 15 seconds if connected
setInterval(async () => {
  if (provider && userAddress) {
    try {
      await updateFeeBadge();
    } catch (e) {
      console.warn("Background balance update failed:", e);
    }
  }
}, 15000);

// Export for testing
export { connectWallet, loadTimeline, addCard };
