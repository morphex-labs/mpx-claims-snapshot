import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require('dotenv').config();

// console.log(Number(process.env.BSC_SNAPSHOT_BLOCK))

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      forking: {
        url: process.env.BSC_NODE_URL || "",
        blockNumber: 31705001
      }
    },
  }
};

export default config;
