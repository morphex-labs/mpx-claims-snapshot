import { ethers } from "hardhat";
import morphiesAbi from '../abi/morphies.json';
import stakingAbi from '../abi/nftStaking.json';
import * as fs from 'node:fs/promises';
import { Holder, MORPHIES_ADDRESS, STAKING_ADDRESS } from "./helpers";
import { BigNumberish } from "ethers";
const cliProgress = require('cli-progress');
// MPX single staked & held in wallet for both Fantom and BSC. 
// MPX-FTM LPs on FVM and Equalizer
// MPX-BNB on Thena

var owners: { [id: string]: Holder; } = {}

function addNftToOwner(owner: string, id: number) {
  if (owner in owners) {
    owners[owner].amount += 1;
    owners[owner].ids.push(id);
  } else {
    owners[owner] = { address: owner, amount: 1, ids: [id] };
  }
}

async function snapshotHolders(): Promise<BigNumberish> {
  // create a new progress bar instance and use shades_classic theme
  let morphiesBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  let morphies = await ethers.getContractAt(
    morphiesAbi,
    MORPHIES_ADDRESS,
    undefined);
  let totalSupply = await morphies.totalSupply();
  morphiesBar.start(Number(totalSupply), 0);
  for (let i = 0; i < totalSupply; i++) {
    morphiesBar.update(i + 1);
    let owner = await morphies.ownerOf(i + 1);
    addNftToOwner(owner, i + 1);
  }
  morphiesBar.stop();
  return totalSupply;
}

async function snapshotStakers() {
  let stakingBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  let staking = await ethers.getContractAt(
    stakingAbi,
    STAKING_ADDRESS,
    undefined);

  let stakedNfts = owners[STAKING_ADDRESS].ids.length;
  stakingBar.start(stakedNfts, 0);
  for (let i = 0; i < stakedNfts; i++) {
    stakingBar.update(i + 1);
    let id = owners[STAKING_ADDRESS].ids[i];
    let owner = await staking.tokenOwner(id);
    addNftToOwner(owner, id);
  }
  stakingBar.stop();
}

function createSortedHolderArray(): Holder[] {
  var holders: Holder[] = [];
  for (var owner in owners) {
    holders.push(owners[owner]);
  }

  holders.sort((a: Holder, b: Holder) => {
    if (a.amount > b.amount) return -1;
    else if (a.amount < b.amount) return 1;
    else return 0;
  })

  return holders;
}

async function saveSnapshotAsJson(data: Holder[], snapshotBlock: BigNumberish) {
  let ownersJson = JSON.stringify(data);
  await fs.writeFile(`data/morphies_snapshot_${snapshotBlock}.json`, ownersJson);
  console.log(`Snapshot saved as data/morphies_snapshot_${snapshotBlock}.json`);
}

function checkSnapshotCorrectness(data: Holder[], totalSupply: BigNumberish) {
  var sum = 0;
  for (var i = 0; i < data.length; i++) {
    sum += data[i].amount;
  }
  if (sum != totalSupply) {
    console.log("NFTs sum doesn't match");
    console.log("Expected:", totalSupply);
    console.log("Checked:", sum);
    return -1;
  }
  console.log("Snapshot data is OK");
}

async function main() {
  let snapshotBlock = await ethers.provider.getBlockNumber()
  console.log("Snapshot block:", snapshotBlock);

  console.log("Getting NFT holders...");
  let totalSupply = await snapshotHolders();

  console.log("Getting NFT stakers...");
  await snapshotStakers();

  // Delete staking contract from json
  delete owners[STAKING_ADDRESS];
  // Sort owners by nft amounts
  let sortedOwners = createSortedHolderArray();

  console.log("Checking Snapshot data...")
  checkSnapshotCorrectness(sortedOwners, totalSupply);

  console.log("saving JSON...");
  await saveSnapshotAsJson(sortedOwners, snapshotBlock);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
