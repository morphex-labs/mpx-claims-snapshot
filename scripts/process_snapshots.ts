import * as fs from "node:fs/promises";
import {
  EOA_BLACKLIST,
  AirdropReceiver,
  AirdropReceiverFormatted,
  Holder,
  MpxHolder,
} from "../utils/constants";

var ftmholders: MpxHolder[] = [];
var bnbHolders: MpxHolder[] = [];
var airdropReceivers: AirdropReceiver[] = [];
var airdropAmount: bigint;
var lpScalingFactor: number;

async function loadData() {
  try {
    let path = `data/mpx_ftm_snapshot_${process.env.FANTOM_SNAPSHOT_BLOCK}.json`;
    console.log(`Getting MPX holders from ${path}...`);
    let jsonHolders = await fs.readFile(path, "utf8");
    ftmholders = JSON.parse(jsonHolders) as MpxHolder[];
  } catch (err) {
    console.log(err);
    throw err;
  }

  try {
    console.log(
      `Getting MPX holders from data/mpx_bnb_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json...`
    );
    let jsonHolders = await fs.readFile(
      `data/mpx_bnb_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json`,
      "utf8"
    );
    bnbHolders = JSON.parse(jsonHolders) as MpxHolder[];
  } catch (err) {
    console.log(err);
    throw err;
  }

  // line break
  console.log("");

  airdropAmount = BigInt(process.env.AIRDROP_AMOUNT || 0) * BigInt(1e6); // 6 decimals for USDC
  if (airdropAmount == BigInt(0)) {
    throw new Error("AIRDROP_AMOUNT in .env not defined");
  } else {
    console.log(`Airdrop amount: ${airdropAmount / BigInt(1e6)} axlUSDC`);
  }

  lpScalingFactor = Number(process.env.LP_SCALING_FACTOR || 0);
  if (lpScalingFactor == 0) {
    throw new Error("LP_SCALING_FACTOR in .env not defined");
  } else {
    console.log(`LP scaling factor: ${lpScalingFactor}`);
  }
}

function scaleLpAmounts() {
  var specialOverrideAddr = "0x8Bac2F2Dd406270578265f5CF296395517CE398c";
  var specialAddressFound = false;

  for (var i in ftmholders) {
    let holder = ftmholders[i];
    var lpScaled =
      (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
    var esmpxAmount = holder.amountEsmpx ? BigInt(holder.amountEsmpx) : BigInt(0);
    var index = airdropReceivers.findIndex(
      (h) => h.address.toLowerCase() == holder.address.toLowerCase()
    );
    if (
        holder.address.toLowerCase() == specialOverrideAddr.toLowerCase() ||
        (lpScaled + BigInt(holder.amount) + esmpxAmount >= BigInt(52000000000000000000))
    ) {
      if (holder.address.toLowerCase() == specialOverrideAddr.toLowerCase()) {
        specialAddressFound = true;
        console.log(
            `Including special address override regardless of balance: ${specialOverrideAddr}`
        );
      }
      if (index == -1) {
        airdropReceivers.push({
          address: holder.address.toLowerCase(),
          amount: BigInt(holder.amount) + lpScaled + esmpxAmount,
          percent: 0,
        });
      } else {
        airdropReceivers[index].amount += BigInt(holder.amount) + lpScaled + esmpxAmount;
      }
    }
  }
  for (var i in bnbHolders) {
    let holder = bnbHolders[i];
    var lpScaled =
      (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
    var esmpxAmount = BigInt(0);
    var index = airdropReceivers.findIndex(
      (h) => h.address.toLowerCase() == holder.address.toLowerCase()
    );
    if (
      holder.address.toLowerCase() == specialOverrideAddr.toLowerCase() ||
      (lpScaled + BigInt(holder.amount) + esmpxAmount >= BigInt(52000000000000000000))
    ) {
      if (holder.address.toLowerCase() == specialOverrideAddr.toLowerCase()) {
        specialAddressFound = true;
        console.log(
          `Including special address override regardless of balance: ${specialOverrideAddr}`
        );
      }
      if (index == -1) {
        airdropReceivers.push({
          address: holder.address.toLowerCase(),
          amount: BigInt(holder.amount) + lpScaled + esmpxAmount,
          percent: 0,
        });
      } else {
        airdropReceivers[index].amount += BigInt(holder.amount) + lpScaled + esmpxAmount;
      }
    }
  }

  if (!specialAddressFound) {
    console.warn(
        `WARNING: Special address ${specialOverrideAddr} not found in either FTM or BNB lists!`
    );
  }
}

function checkScaledLpSum() {
  var sum = BigInt(0);
  var sumLp = BigInt(0);
  var sumEsmpx = BigInt(0);
  var scaledSum = BigInt(0);
  var specialOverrideAddr = "0x8Bac2F2Dd406270578265f5CF296395517CE398c";

  for (var i in ftmholders) {
    let holder = ftmholders[i];
    var lpScaled =
      (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
    var esmpxAmount = holder.amountEsmpx ? BigInt(holder.amountEsmpx) : BigInt(0);
    if (
      holder.address.toLowerCase() == specialOverrideAddr.toLowerCase() ||
      (lpScaled + BigInt(holder.amount) + esmpxAmount >= BigInt(52000000000000000000))
    ) {
      sum += BigInt(ftmholders[i].amount);
      sumLp += BigInt(ftmholders[i].amountLp);
      sumEsmpx += esmpxAmount;
    }
  }
  for (var i in bnbHolders) {
    let holder = bnbHolders[i];
    var lpScaled =
      (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
    if (
      holder.address.toLowerCase() == specialOverrideAddr.toLowerCase() ||
      (lpScaled + BigInt(holder.amount) >= BigInt(52000000000000000000))
    ) {
      sum += BigInt(bnbHolders[i].amount);
      sumLp += BigInt(bnbHolders[i].amountLp);
    }
  }
  for (var i in airdropReceivers) {
    scaledSum += airdropReceivers[i].amount;
  }

  let checked = scaledSum - sum - sumEsmpx;
  let expected = (sumLp * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
  console.log(`Scaled:\t\t${checked}`);
  console.log(`Expected:\t${expected}`);
  if (checked - expected >= 0 && checked - expected < 1e6) {
    console.log("Calculation difference < 1e-12");
  } else if (expected - checked >= 0 && expected - checked < 1e6) {
    console.log("Calculation difference < 1e-12");
  } else {
    throw new Error("Error in calculations");
  }
  console.log(`All MPX: ${scaledSum}`);
  return scaledSum;
}

function transformAmounts(tokensPerMpxNum: bigint, tokensPerMpxDen: bigint) {
  for (var i = 0; i < airdropReceivers.length; i++) {
    airdropReceivers[i].amount = (airdropReceivers[i].amount * tokensPerMpxNum) / tokensPerMpxDen;
  }
}

function blacklistEoas() {
  for (var i in EOA_BLACKLIST) {
    ftmholders = ftmholders.filter(
      (holder) => holder.address.toLowerCase() != EOA_BLACKLIST[i].toLowerCase()
    );
    bnbHolders = bnbHolders.filter(
      (holder) => holder.address.toLowerCase() != EOA_BLACKLIST[i].toLowerCase()
    );
  }
}

function checkAndFixAirdropAmounts() {
  var sum = BigInt(0);
  for (var i in airdropReceivers) {
    sum += airdropReceivers[i].amount;
  }
  console.log(`Checked:\t${sum}`);
  console.log(`Expected:\t${airdropAmount}`);
  if (airdropAmount - sum < 1e9) {
    console.log("Difference < 1e9");
    console.log(`Adding ${airdropAmount - sum} (1e-18) to random holder`);
    var randomIndex = Math.floor(Math.random() * (airdropReceivers.length - 1));
    console.log(`Random holder index: ${randomIndex}`);
    console.log(
      `Random holder amount before: ${airdropReceivers[randomIndex].amount}`
    );
    airdropReceivers[randomIndex].amount += airdropAmount - sum;
    console.log(
      `Random holder amount after: ${airdropReceivers[randomIndex].amount}`
    );

    sum = BigInt(0);
    for (var i in airdropReceivers) {
      sum += airdropReceivers[i].amount;
    }
    console.log(`Fixed:\t\t${sum}`);
    console.log(`Expected:\t${airdropAmount}`);
    if (sum != airdropAmount) {
      throw new Error("Error in calculations, aborting...");
    }
  } else {
    throw new Error("Difference too big, aborting...");
  }
}

function calculatePercentages() {
  for (var i in airdropReceivers) {
    airdropReceivers[i].percent =
      Number(
        (airdropReceivers[i].amount * BigInt(1e18)) / BigInt(airdropAmount)
      ) / 1e16;
  }

  var sum = 0;
  for (var i in airdropReceivers) {
    sum += airdropReceivers[i].percent;
  }

  console.log(`Expected:\t${100.0}`);
  console.log(`Sum:\t\t${sum}`);
  if (1 - sum < 1e-9) {
    console.log(`Difference negligable`);
  } else {
    throw new Error("Error in calculations, aborting...");
  }
}

function formatAirdropReceivers(receivers: AirdropReceiver[]) {
  return receivers.map((h) => ({
    address: h.address,
    amount: h.amount.toString(),
    percent: h.percent,
  }));
}

function sortAirdrop(holders: AirdropReceiver[]) {
  holders.sort((a: AirdropReceiver, b: AirdropReceiver) => {
    if (a.amount > b.amount) return -1;
    else if (a.amount < b.amount) return 1;
    else return 0;
  });
}

async function saveSnapshotAsJson(
  data: AirdropReceiverFormatted[],
  snapshotFtmBlock: string,
  snapshotBscBlock: string
) {
  let airdropJson = JSON.stringify(data);
  let path = `data/mpx_final_snapshot_ftm_${snapshotFtmBlock}_bsc_${snapshotBscBlock}.json`;
  await fs.writeFile(path, airdropJson);
  console.log(`Snapshot saved as ${path}`);
}

async function cleanAndSplitArrays(
  addressesData: string[],
  amountsData: string[],
  splitCount: number = 4
): Promise<[string[], string[]]> {
  if (addressesData.length !== amountsData.length) {
    throw new Error("Addresses and amounts arrays have different lengths!");
  }

  // Split arrays into chunks due to high gas usage when whitelisting in the contract
  const chunkSize = Math.ceil(addressesData.length / splitCount);
  const addressesChunks = [];
  const amountsChunks = [];

  for (let i = 0; i < splitCount; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    addressesChunks.push(
      addressesData.slice(start, end).map((item) => item.replace(/"/g, ""))
    );
    amountsChunks.push(
      amountsData.slice(start, end).map((item) => item.replace(/"/g, ""))
    );
  }

  return [
    addressesChunks.map((chunk) => `[${chunk.join(",")}]`),
    amountsChunks.map((chunk) => `[${chunk.join(",")}]`),
  ];
}

async function saveArrays(
  addressesData: string[],
  amountsData: string[]
): Promise<void> {
  const [addressesChunks, amountsChunks] = await cleanAndSplitArrays(
    addressesData,
    amountsData
  );

  let addressesSplit = addressesChunks
    .map((chunk, i) => `Array ${i + 1}:\n${chunk}\n`)
    .join("\n");
  let amountsSplit = amountsChunks
    .map((chunk, i) => `Array ${i + 1}:\n${chunk}\n`)
    .join("\n");

  const basePath = `data/mpx_final_snapshot`;
  const paths = {
    addressesJson: `${basePath}_addresses.json`,
    amountsJson: `${basePath}_amounts.json`,
    addressesTxt: `${basePath}_addresses_split.txt`,
    amountsTxt: `${basePath}_amounts_split.txt`,
  };

  // Save all arrays to files
  await Promise.all([
    fs.writeFile(paths.addressesTxt, addressesSplit),
    fs.writeFile(paths.amountsTxt, amountsSplit),
  ]);

  console.log("Snapshots saved in arrays!");
}

async function main() {
  let ftmSnapshotBlock = process.env.FANTOM_SNAPSHOT_BLOCK;
  let bscSnapshotBlock = process.env.BSC_SNAPSHOT_BLOCK;
  console.log("FTM Snapshot block:", ftmSnapshotBlock);
  console.log("BNB Snapshot block:", bscSnapshotBlock);

  await loadData();

  // line break
  console.log("");

  console.log("Blacklisting EOAs...");
  blacklistEoas();

  console.log("Scaling LP amounts...");
  scaleLpAmounts();
  let allMpx = checkScaledLpSum();

  console.log("Transforming token amounts...");
  transformAmounts(airdropAmount, allMpx);

  console.log("Checking airdrop amounts...");
  checkAndFixAirdropAmounts();

  console.log("Calculate percentage values");
  calculatePercentages();

  // Filter out zero airdrop addresses
  airdropReceivers = airdropReceivers.filter((h) => h.amount > BigInt(0));

  console.log("Saving final JSON...");
  sortAirdrop(airdropReceivers);
  let formatted = formatAirdropReceivers(airdropReceivers);
  await saveSnapshotAsJson(
    formatted,
    ftmSnapshotBlock as string,
    bscSnapshotBlock as string
  );

  var addresses: string[] = [];
  var amounts: string[] = [];
  for (var i in airdropReceivers) {
    addresses.push(airdropReceivers[i].address);
    amounts.push(airdropReceivers[i].amount.toString());
  }

  for (var i in airdropReceivers) {
    if (
      addresses[i] != airdropReceivers[i].address ||
      amounts[i] != airdropReceivers[i].amount.toString()
    )
      throw new Error(`Error saving formatted`);
  }

  await saveArrays(addresses, amounts);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
