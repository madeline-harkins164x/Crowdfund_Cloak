# Crowdfund Cloak: A Private Decentralized Crowdfunding Platform

Crowdfund Cloak is a revolutionary decentralized crowdfunding platform that leverages **Zama's Fully Homomorphic Encryption (FHE) technology** to protect the privacy of early supporters. By enabling project creators to raise funds discreetly, Crowdfund Cloak ensures that the identities and contribution amounts of supporters remain confidential while still allowing for transparency in fundraising progress.

## The Challenge of Traditional Crowdfunding

In the current landscape, many crowdfunding platforms expose sensitive information about contributors, making them vulnerable to unwanted attention, data breaches, or even exploitation. Early supporters often fear that their identities and contributions could be visible to competitors or malicious entities, hindering their willingness to engage in innovative projects. This situation creates a barrier for startups seeking to raise funds securely and for supporters wanting to contribute without compromising their privacy.

## Zama’s FHE Solution

Crowdfund Cloak addresses these concerns head-on. By utilizing **Zama's open-source libraries**—such as **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**—we can encrypt user contributions in a way that they remain confidential while still allowing the platform to report overall fundraising progress. This implementation of Fully Homomorphic Encryption means project creators can benefit from private contributions, while supporters can take part in the funding without revealing their identities or amounts contributed.

## Core Functionalities

Here's what makes Crowdfund Cloak an outstanding solution for decentralized crowdfunding:

- 🔒 **Privacy-First Contributions**: Users can contribute FHE tokens while keeping their identities and amounts confidential.
- 📊 **Transparent Fundraising Progress**: Projects can publicly display total funding achieved without exposing individual contributions.
- 🔄 **Optional Disclosure**: Supporters have the choice to publicly share their support if they wish, promoting collaboration without compromising privacy.
- 🛡️ **Protection Against Cloning**: Supports innovation by safeguarding early projects from being copied by larger entities in the industry.

## Technology Stack

Crowdfund Cloak is built using a comprehensive technology stack focused on confidentiality and decentralization:

- **Zama FHE SDK**: The core technology enabling encrypted computations.
- **Solidity**: For smart contract development on the Ethereum blockchain.
- **Node.js**: For server-side logic and managing dependencies.
- **Hardhat**: As a development framework for compiling, deploying, and testing smart contracts.
  
## Directory Structure

Here’s the structure of our project:

```
Crowdfund_Cloak/
│
├── contracts/
│   └── Crowdfund_Cloak.sol
│
├── scripts/
│   ├── deploy.js
│   └── contribution.js
│
├── test/
│   ├── test_crowdfund.js
│   └── test_contribution.js
│
├── package.json
└── hardhat.config.js
```

## Installation Instructions

To set up Crowdfund Cloak on your local environment, follow these steps:

1. Ensure you have **Node.js** installed on your machine.
2. Download the project files (do not use `git clone`).
3. Navigate to the project directory in your terminal.
4. Run the following command to install the necessary dependencies, including Zama FHE libraries:

   ```bash
   npm install
   ```

## Building and Running the Project

To compile and run Crowdfund Cloak, execute the following commands in your terminal:

1. Compile the smart contracts:

   ```bash
   npx hardhat compile
   ```

2. Deploy the contracts to your desired network (e.g., local development network):

   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. Run tests to ensure everything is functioning as expected:

   ```bash
   npx hardhat test
   ```

## Sample Code

Here’s a brief code snippet showing how to add a contribution while maintaining privacy:

```javascript
const { ethers } = require("hardhat");

async function main() {
    const CrowdfundCloak = await ethers.getContractFactory("Crowdfund_Cloak");
    const crowdfundCloak = await CrowdfundCloak.deploy();

    await crowdfundCloak.deployed();

    // Encrypt the contribution amount using Zama's FHE
    const encryptedAmount = await encryptContribution(userContribution);

    const tx = await crowdfundCloak.addContribution(encryptedAmount);
    await tx.wait();

    console.log("Contribution added with privacy!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

This example illustrates how to integrate FHE for handling contributions securely. The actual encryption logic should utilize Zama's SDK methods for FHE.

## Acknowledgements

### Powered by Zama

We extend our heartfelt gratitude to the Zama team for their pioneering work in Fully Homomorphic Encryption and their open-source tools, which empower developers to create confidential blockchain applications like Crowdfund Cloak. Your commitment to enhancing privacy in decentralized finance is making waves in the industry!
