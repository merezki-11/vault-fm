import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const { ethers } = connection;

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with address:", deployer.address);

  const nft = await ethers.deployContract("MemoryNFT");
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("MemoryNFT deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
