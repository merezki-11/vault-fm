// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BagsCreatorToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        // Mint the initial supply to the deployer's address (your wallet)
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /// @dev Mint more tokens for rewards or community incentives
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
