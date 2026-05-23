import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const { ethers } = connection;

  const [deployer] = await ethers.getSigners();
  console.log("=========================================");
  console.log("Deploying Bags Ecosystem with address:", deployer.address);
  console.log("=========================================");

  // 1️⃣ Deploy BagsCreatorToken
  console.log("Deploying BagsCreatorToken...");
  const initialSupply = 1000000; // 1 Million tokens
  const token = await ethers.deployContract("BagsCreatorToken", [
    "Bags Creator Token",
    "BAGS",
    initialSupply
  ]);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("BagsCreatorToken deployed to:", tokenAddress);
  console.log(`Initial supply of ${initialSupply} $BAGS fully minted to deployer.`);

  console.log("-----------------------------------------");

  // 2️⃣ Deploy MemoryNFT linked to BagsCreatorToken
  console.log("Deploying MemoryNFT...");
  const nft = await ethers.deployContract("MemoryNFT", [tokenAddress]);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MemoryNFT deployed to:", nftAddress);

  console.log("=========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("BagsCreatorToken Address:", tokenAddress);
  console.log("MemoryNFT Address:", nftAddress);
  console.log("=========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
