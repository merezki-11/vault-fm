// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MemoryNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;

    // The associated Bags Creator Token
    IERC20 public bagsToken;

    // Platform fee pool address (simulating platform treasury via dead address)
    address public constant PLATFORM_FEE_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Base mint fee for non-token holders (0.0001 Sepolia ETH)
    uint256 public constant MINT_FEE = 0.0001 ether;

    // Threshold of tokens required to qualify for 100% free minting (10 tokens)
    uint256 public constant FREE_MINT_THRESHOLD = 10 * 10 ** 18;

    event FeeSplit(address indexed creator, address indexed platform, uint256 creatorShare, uint256 platformShare);

    constructor(address _bagsToken) ERC721("Bags Vault Memory", "BVM") Ownable(msg.sender) {
        require(_bagsToken != address(0), "Invalid token address");
        bagsToken = IERC20(_bagsToken);
    }

    /// @dev Mint a new memory NFT. Enforces the 90/10 fee split unless the sender holds >= 10 Bags tokens.
    function mint(address to, string memory tokenURI) external payable returns (uint256) {
        uint256 balance = bagsToken.balanceOf(msg.sender);

        if (balance < FREE_MINT_THRESHOLD) {
            // Minter does not hold enough tokens: enforce the fee split
            require(msg.value >= MINT_FEE, "Insufficient mint fee paid");

            uint256 creatorShare = (msg.value * 90) / 100;
            uint256 platformShare = msg.value - creatorShare;

            // Send 90% to the contract owner (the creator)
            (bool successCreator, ) = payable(owner()).call{value: creatorShare}("");
            require(successCreator, "Transfer to creator failed");

            // Send 10% to the Bags Platform Fee Pool
            (bool successPlatform, ) = payable(PLATFORM_FEE_ADDRESS).call{value: platformShare}("");
            require(successPlatform, "Transfer to platform fee pool failed");

            emit FeeSplit(owner(), PLATFORM_FEE_ADDRESS, creatorShare, platformShare);
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }
}
