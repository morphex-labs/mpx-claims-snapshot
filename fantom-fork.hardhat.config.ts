import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      forking: {
        url: process.env.FANTOM_NODE_URL || "",
        blockNumber: Number(process.env.FANTOM_SNAPSHOT_BLOCK)
      }
    },
  }
};

export default config;
