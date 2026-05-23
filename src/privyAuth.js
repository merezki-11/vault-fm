// src/privyAuth.js
// ------------------------------------------------------------
// Privy Core JS SDK Integration – OTP Auth & Embedded Wallets
// Handles iframe context, LocalStorage session state, and exports Ethers signers
// ------------------------------------------------------------

import Privy, { LocalStorage, getUserEmbeddedEthereumWallet, sepolia } from "@privy-io/js-sdk-core";
import { ethers } from "ethers";

// Fallback Sandbox Credentials (swap with yours from dashboard.privy.io)
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "clv3lq9990099l801abcde123";
const PRIVY_CLIENT_ID = import.meta.env.VITE_PRIVY_CLIENT_ID || "clv3lq9990099l801abcde123-client";

let privyClient = null;
let privyIframe = null;

/**
 * Initializes the Privy Client and injects the secure embedded wallet iframe context
 */
export async function initPrivy() {
  if (privyClient) return privyClient;

  console.log("Initializing Privy SDK Client...");
  
  privyClient = new Privy({
    appId: PRIVY_APP_ID,
    clientId: PRIVY_CLIENT_ID,
    storage: new LocalStorage(),
    supportedChains: [sepolia]
  });

  // 1️⃣ Initialize the session
  await privyClient.initialize();

  // 2️⃣ Mount the hidden secure iframe required for non-custodial embedded wallet operations
  privyIframe = document.getElementById("privy-secure-iframe");
  if (!privyIframe) {
    privyIframe = document.createElement("iframe");
    privyIframe.id = "privy-secure-iframe";
    privyIframe.src = privyClient.embeddedWallet.getURL();
    privyIframe.style.display = "none";
    document.body.appendChild(privyIframe);
  }

  // 3️⃣ Establish secure bidirectional message passing
  // The Privy SDK expects an object with a postMessage function. We proxy calls
  // to the iframe's contentWindow, waiting for the 'load' event if it's not yet ready.
  privyClient.setMessagePoster({
    postMessage: (message, targetOrigin) => {
      if (privyIframe.contentWindow) {
        privyIframe.contentWindow.postMessage(message, targetOrigin);
      } else {
        privyIframe.addEventListener("load", () => {
          if (privyIframe.contentWindow) {
            privyIframe.contentWindow.postMessage(message, targetOrigin);
          }
        }, { once: true });
      }
    }
  });

  // Handle incoming messages from the secure iframe
  window.addEventListener("message", (event) => {
    if (privyIframe && event.source === privyIframe.contentWindow) {
      privyClient.embeddedWallet.getMessageHandler()(event.data);
    }
  });

  console.log("Privy Client successfully initialized.");
  return privyClient;
}

/**
 * Initiates the Email OTP authentication flow
 * @param {string} email User email address
 */
export async function sendOtp(email) {
  const client = await initPrivy();
  console.log(`Sending OTP code to: ${email}`);
  await client.auth.email.sendCode(email);
  return true;
}

/**
 * Verifies the OTP code to log in the user and instantiate/retrieve their embedded wallet
 * @param {string} email User email address
 * @param {string} code 6-digit OTP code
 */
export async function verifyOtp(email, code) {
  const client = await initPrivy();
  console.log("Verifying OTP code...");
  const session = await client.auth.email.loginWithCode(email, code);
  
  // Retrieve or automatically create an embedded EVM wallet for the logged-in user
  let user = session.user;
  let wallet = getUserEmbeddedEthereumWallet(user);
  if (!wallet) {
    console.log("No embedded wallet found. Creating one securely...");
    const createResult = await client.embeddedWallet.create({});
    user = createResult.user;
    wallet = getUserEmbeddedEthereumWallet(user);
  }

  console.log("User successfully logged in with wallet address:", wallet.address);
  return {
    user: user,
    walletAddress: wallet.address
  };
}

/**
 * Returns an Ethers.js compatible signer for the embedded wallet
 */
export async function getPrivySigner() {
  const client = await initPrivy();
  const userResponse = await client.user.get();
  if (!userResponse || !userResponse.user) {
    throw new Error("No authenticated session found. Please log in first.");
  }
  const wallet = getUserEmbeddedEthereumWallet(userResponse.user);
  if (!wallet) {
    throw new Error("No authenticated embedded wallet session found. Please log in first.");
  }

  // Get the EIP-1193 provider from Privy's embedded wallet
  const provider = await client.embeddedWallet.getProvider(wallet);
  
  // Force switch to Sepolia (chainId 11155111 = 0xaa36a7)
  // The provider defaults to mainnet because DEFAULT_SUPPORTED_CHAINS[0] is chain 1
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }]
    });
    console.log("[getPrivySigner] Switched embedded wallet to Sepolia (11155111)");
  } catch (switchErr) {
    console.warn("[getPrivySigner] Chain switch warning:", switchErr);
  }

  const browserProvider = new ethers.BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  return signer;
}

/**
 * Returns current authenticated user and wallet address if exists
 */
export async function getPrivyUser() {
  const client = await initPrivy();
  const userResponse = await client.user.get();
  if (!userResponse || !userResponse.user) return null;

  const wallet = getUserEmbeddedEthereumWallet(userResponse.user);
  return {
    user: userResponse.user,
    walletAddress: wallet ? wallet.address : null
  };
}

/**
 * Logs the user out and clears LocalStorage sessions
 */
export async function privyLogout() {
  const client = await initPrivy();
  await client.auth.logout();
  console.log("Logged out successfully.");
}

/**
 * Shows the Privy secure iframe modal for user transaction confirmation
 */
export function showPrivyIframe() {
  const iframe = document.getElementById("privy-secure-iframe");
  if (iframe) {
    iframe.style.display = "block";
    iframe.style.opacity = "1";
    iframe.style.pointerEvents = "auto";
  }
}

/**
 * Hides the Privy secure iframe modal after transaction completes or fails
 */
export function hidePrivyIframe() {
  const iframe = document.getElementById("privy-secure-iframe");
  if (iframe) {
    iframe.style.display = "none";
  }
}
