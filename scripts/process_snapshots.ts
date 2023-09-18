import * as fs from 'node:fs/promises';
import { AirdropReceiver, AirdropReceiverFormatted, Holder, MpxHolder } from "../utils/constants";

var ftmholders: MpxHolder[] = [];
var bnbHolders: MpxHolder[] = [];
var morphies: Holder[] = [];
var airdropReceivers: AirdropReceiver[] = [];
var airdropAmount: bigint;
var morphiesAirdropPC: number;
var lpScalingFactor: number;

async function loadData() {
    try {
        let path = `data/mpx_ftm_snapshot_${process.env.FANTOM_SNAPSHOT_BLOCK}.json`;
        console.log(`Getting MPX holders from ${path}...`);
        let jsonHolders = await fs.readFile(path, 'utf8');
        ftmholders = JSON.parse(jsonHolders) as MpxHolder[];
    } catch (err) {
        console.log(err)
        throw err;
    }

    try {
        console.log(`Getting MPX holders from data/mpx_bnb_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json...`);
        let jsonHolders = await fs.readFile(`data/mpx_bnb_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json`, 'utf8');
        bnbHolders = JSON.parse(jsonHolders) as MpxHolder[];
    } catch (err) {
        console.log(err);
        throw err;
    }

    try {
        console.log(`Getting Morphies holders from data/morphies_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json...`);
        let jsonHolders = await fs.readFile(`data/morphies_snapshot_${process.env.BSC_SNAPSHOT_BLOCK}.json`, 'utf8');
        morphies = JSON.parse(jsonHolders) as Holder[];
    } catch (err) {
        console.log(err);
        throw err;
    }

    // line break
    console.log("")

    airdropAmount = BigInt(process.env.AIRDROP_AMOUNT || 0);
    if (airdropAmount == BigInt(0)) {
        throw new Error("AIRDROP_AMOUNT in .env not defined");
    } else {
        console.log(`Airdrop amount: ${airdropAmount}`);
    }

    morphiesAirdropPC = Number(process.env.MORPHIES_AIRDROP_PC || 0);
    if (morphiesAirdropPC == 0) {
        throw new Error("MORPHIES_AIRDROP_PC in .env not defined");
    } else if (morphiesAirdropPC >= 100) {
        throw new Error("MORPHIES_AIRDROP_PC is above 100%");
    } else {
        console.log(`Morphies airdrop: ${morphiesAirdropPC}%`);
    }

    lpScalingFactor = Number(process.env.LP_SCALING_FACTOR || 0);
    if (lpScalingFactor == 0) {
        throw new Error("LP_SCALING_FACTOR in .env not defined");
    } else {
        console.log(`LP scaling factor: ${lpScalingFactor}`);
    }
}

function scaleLpAmounts() {
    for (var i in ftmholders) {
        let holder = ftmholders[i];
        var lpScaled = (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
        airdropReceivers.push({ address: holder.address.toLowerCase(), amount: BigInt(holder.amount) + lpScaled, percent: 0 });
    }
    for (var i in bnbHolders) {
        let holder = bnbHolders[i];
        var lpScaled = (BigInt(holder.amountLp) * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
        var index = airdropReceivers.findIndex((h) => h.address.toLowerCase() == bnbHolders[i].address.toLowerCase());
        if (index == -1) {
            airdropReceivers.push({ address: holder.address.toLowerCase(), amount: BigInt(holder.amount) + lpScaled, percent: 0 });
        } else {
            airdropReceivers[index].amount += BigInt(holder.amount) + lpScaled;
        }
    }

}

function checkScaledLpSum() {
    var sum = BigInt(0);
    var sumLp = BigInt(0);
    var scaledSum = BigInt(0);

    for (var i in ftmholders) {
        sum += BigInt(ftmholders[i].amount);
        sumLp += BigInt(ftmholders[i].amountLp);
    }
    for (var i in bnbHolders) {
        sum += BigInt(bnbHolders[i].amount);
        sumLp += BigInt(bnbHolders[i].amountLp);
    }
    for (var i in airdropReceivers) {
        scaledSum += airdropReceivers[i].amount;
    }

    let checked = scaledSum - sum;
    let expected = (sumLp * BigInt(lpScalingFactor * 1000)) / BigInt(1000);
    console.log(`Scaled:\t\t${checked}`);
    console.log(`Expected:\t${expected}`);
    if (checked - expected >= 0 && (checked - expected) < 1000) {
        console.log("Calculation difference < 1e-14")
    } else if (expected - checked >= 0 && (expected - checked) < 1000) {
        console.log("Calculation difference < 1e-14")
    } else {
        throw new Error("Error in calcualtions");
    }
    return scaledSum;
}

function transformAmounts(tokensPerAmount: bigint) {
    for (var i in airdropReceivers) {
        airdropReceivers[i].amount = (airdropReceivers[i].amount * tokensPerAmount) / BigInt(1e18);
    }
}

function checkTransformedAmounts(expectedSum: bigint) {
    var checkedSum = BigInt(0);
    for (var i in airdropReceivers) {
        checkedSum += airdropReceivers[i].amount;
    }

    console.log(`Cehcked sum:\t${checkedSum}`);
    console.log(`Expected sum:\t${expectedSum}`);
    if (expectedSum - checkedSum > 0 && (expectedSum - checkedSum) < 1e9) {
        console.log("Calculation difference < 1e9")
    } else {
        throw new Error("Error in calcualtions");
    }
    return expectedSum - checkedSum;
}

function addAirdropForMorphies(airdropAmount: bigint) {
    var sum = 0;
    for (var i in morphies) {
        sum += Number(morphies[i].amount);
    }

    console.log(`Morphies amount:\t${sum}`);
    console.log(`oBMX per Morphie:\t${airdropAmount / BigInt(sum)}`);

    var amounts: MpxHolder[] = [];
    for (var i in morphies) {
        amounts.push({ address: morphies[i].address, amount: ((BigInt(morphies[i].amount) * airdropAmount) / BigInt(sum)).toString(), amountLp: BigInt(0).toString(), isContract: false });
    }

    for (var i in amounts) {
        let index = airdropReceivers.findIndex((h) => h.address.toLowerCase() == amounts[i].address.toLowerCase());
        if (index == -1) {
            airdropReceivers.push({ address: amounts[i].address, amount: BigInt(amounts[i].amount), percent: 0 })
        } else {
            airdropReceivers[index].amount += BigInt(amounts[i].amount)
        }
    }

}

function checkAndFixAirdropAmounts() {
    var sum = BigInt(0);
    for (var i in airdropReceivers) {
        sum += airdropReceivers[i].amount;
    }
    console.log(`Checked:\t${sum}`)
    console.log(`Expected:\t${airdropAmount}`)
    if (airdropAmount - sum < 1e3) {
        console.log("Difference < 1e3")
        console.log(`Adding ${airdropAmount - sum} (1e-18) to random holder`)
        var randomIndex = Math.floor(Math.random() * (airdropReceivers.length - 1));
        console.log(`Random holder index: ${randomIndex}`);
        console.log(`Random holder amount before: ${airdropReceivers[randomIndex].amount}`);
        airdropReceivers[randomIndex].amount += (airdropAmount - sum);
        console.log(`Random holder amount after: ${airdropReceivers[randomIndex].amount}`);

        sum = BigInt(0);
        for (var i in airdropReceivers) {
            sum += airdropReceivers[i].amount;
        }
        console.log(`Fixed:\t\t${sum}`)
        console.log(`Expected:\t${airdropAmount}`)
        if (sum != airdropAmount) {
            throw new Error("Error in calcualations, aborting...");
        }
    } else {
        throw new Error("Difference too big, aborting...");
    }
}

function calculatePercentages() {
    for (var i in airdropReceivers) {
        airdropReceivers[i].percent = Number((airdropReceivers[i].amount * BigInt(1e18)) / BigInt(airdropAmount)) / 1e16;
    }

    var sum = 0;
    for (var i in airdropReceivers) {
        sum += airdropReceivers[i].percent;
    }

    console.log(`Expected:\t${100.0}`)
    console.log(`Sum:\t\t${sum}`)
    if (1 - sum < 1e-9) {
        console.log(`Difference negligable`)
    } else {
        throw new Error("Error in calculations, aborting...")
    }
}

function formatAirdropReceivers(receivers: AirdropReceiver[]) {
    return receivers.map((h) => ({ address: h.address, amount: h.amount.toString(), percent: h.percent }))

}

function sortAirdrop(holders: AirdropReceiver[]) {
    holders.sort((a: AirdropReceiver, b: AirdropReceiver) => {
        if (a.amount > b.amount) return -1;
        else if (a.amount < b.amount) return 1;
        else return 0;
    })
}

async function saveSnapshotAsJson(data: AirdropReceiverFormatted[], snapshotFtmBlock: string, snapshotBscBlock: string) {
    let airdropJson = JSON.stringify(data);
    let path = `data/mpx_final_snapshot_ftm_${snapshotFtmBlock}_bsc_${snapshotBscBlock}.json`;
    await fs.writeFile(path, airdropJson);
    console.log(`Snapshot saved as ${path}`);
}

async function main() {
    let ftmSnapshotBlock = process.env.FANTOM_SNAPSHOT_BLOCK;
    let bscSnapshotBlock = process.env.BSC_SNAPSHOT_BLOCK;
    console.log("FTM Snapshot block:", ftmSnapshotBlock);
    console.log("BNB Snapshot block:", bscSnapshotBlock);

    await loadData();

    var morphiesAirdrop = (airdropAmount * BigInt(morphiesAirdropPC * 1000)) / BigInt(100000);
    let holdersAirdrop = airdropAmount - morphiesAirdrop;

    console.log(`Holders airdrop\t\t(${100 - morphiesAirdropPC}%): ${holdersAirdrop}`);
    console.log(`Morphies airdrop\t(${morphiesAirdropPC}%): ${morphiesAirdrop}`);

    // line break
    console.log("")

    console.log("Scaling LP amounts...")
    scaleLpAmounts();
    let allMpx = checkScaledLpSum();
    let tokensPerMpx = (holdersAirdrop * BigInt(1e18)) / allMpx;

    console.log(`oBMX per 1 MPX: ${tokensPerMpx}`);

    console.log("Transforming token amounts...");
    transformAmounts(tokensPerMpx);
    let amountsDiffernce = checkTransformedAmounts(holdersAirdrop);

    // Add difference to Morphies airdrop
    morphiesAirdrop += amountsDiffernce;

    console.log("Adding morphies airdrop...");
    addAirdropForMorphies(morphiesAirdrop);

    console.log("Checking airdrop amounts...");
    checkAndFixAirdropAmounts();

    console.log("Calculate percentage values");
    calculatePercentages();

    // Filter out zero airdrop addresses
    airdropReceivers = airdropReceivers.filter((h) => h.amount > BigInt(0));

    console.log("Saving final JSON...");
    sortAirdrop(airdropReceivers);
    let formatted = formatAirdropReceivers(airdropReceivers);
    await saveSnapshotAsJson(formatted, ftmSnapshotBlock as string, bscSnapshotBlock as string);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
