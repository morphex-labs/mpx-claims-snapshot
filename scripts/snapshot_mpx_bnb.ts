import { ethers } from "hardhat";
import mpxBnbAbi from '../abi/mpx_bnb.json';
import pairAbi from '../abi/pair.json';
import rewardTrackerAbi from '../abi/reward_tracker.json';
import gaugeAbi from '../abi/gauge_v2.json';
import * as fs from 'node:fs/promises';
import { INCREMENT, MPX_BNB_ADDRESS, MPX_BNB_CREATE_BLOCK, MPX_BNB_LP_GAUGE_ADDRESS, MPX_BNB_LP_PAIR_ADDRESS, MPX_BNB_REWARD_TRACKER_ADDRESS, MpxHolder } from "../utils/constants";
import { BigNumberish, EventLog } from "ethers";
import { retry } from "../utils/helpers";
const cliProgress = require('cli-progress');

// MPX single staked & held in wallet for Fantom. 
// MPX-FTM LPs on FVM and Equalizer

var balances: { [id: string]: bigint; } = {}
var holders: MpxHolder[] = [];

async function snapshotHolders(snapshotBlock: number): Promise<MpxHolder[]> {
    // create a new progress bar instance and use shades_classic theme
    console.log("Processing transfer events...");
    let mpxBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let mpx = await ethers.getContractAt(
        mpxBnbAbi,
        MPX_BNB_ADDRESS,
        undefined);
    mpxBar.start(snapshotBlock - MPX_BNB_CREATE_BLOCK, 0);
    let filter = mpx.filters.Transfer();
    let increment = INCREMENT;

    try {
        for (var i = MPX_BNB_CREATE_BLOCK; i < snapshotBlock; i = i + increment + 1) {
            mpxBar.update(i + increment + 1 - MPX_BNB_CREATE_BLOCK);
            var end = i + increment;
            if (end >= snapshotBlock) end = snapshotBlock;
            var events = await retry(3, mpx.queryFilter(filter, i, end)) as EventLog[];
            events.forEach((event) => {
                let from: string = event.args.from;
                let to: string = event.args.to;
                if (to !== from) {
                    var fromValue: bigint;
                    var toValue: bigint;

                    if (from in balances) {
                        fromValue = balances[from];
                    } else fromValue = BigInt(0);
                    if (to in balances) {
                        toValue = balances[to];
                    } else toValue = BigInt(0);

                    if (from != ethers.ZeroAddress) {
                        balances[from] = fromValue - BigInt(event.args.value);
                    }
                    balances[to] = toValue + BigInt(event.args.value);
                }
            });
        }
        console.log("Events processed");
    } catch (e: any) {
        console.log(e.message);
        throw e;
    } finally {
        mpxBar.stop();

        console.log("Saving JSON...");

        var mpxHolders: MpxHolder[] = [];
        for (var key in balances) {
            mpxHolders.push({ address: key, amount: balances[key].toString(), amountLp: BigInt(0).toString() });
        }

        sortHolders(mpxHolders);

        await saveSnapshotAsJson(mpxHolders, snapshotBlock);

        return mpxHolders;
    }
}

async function saveSnapshotAsJson(data: MpxHolder[], snapshotBlock: BigNumberish, final: boolean = true) {
    let ownersJson = JSON.stringify(data);
    let path = final ? `data/mpx_bnb_snapshot_${snapshotBlock}.json` : `data/mpx_bnb_raw_snapshot_${snapshotBlock}.json`;
    await fs.writeFile(path, ownersJson);
    console.log(`Snapshot saved as ${path}`);
}

function checkSnapshotCorrectness(data: MpxHolder[], totalSupply: bigint) {
    var sum = BigInt(0);
    for (var i = 0; i < data.length; i++) {
        sum += BigInt(data[i].amount);
        sum += BigInt(data[i].amountLp);
    }
    if (sum == totalSupply) {
        console.log("Snapshot data is OK");
        return;
    } else if (sum < totalSupply && (totalSupply - sum) < BigInt(1e18)) {
        console.log("Difference: ", totalSupply - sum);
        console.log("Snapshot data is OK (1 MPX difference allowed)");
        return;
    } else {
        console.log("MPX sum doesn't match");
        console.log("Expected:", totalSupply);
        console.log("Checked:", sum);
        return -1;
    }
}

async function getTotalSupply(): Promise<bigint> {
    let mpx = await ethers.getContractAt(
        mpxBnbAbi,
        MPX_BNB_ADDRESS,
        undefined);
    return await mpx.totalSupply();
}

async function snapshotStakers() {
    let rewardsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let rewardTracker = await ethers.getContractAt(
        rewardTrackerAbi,
        MPX_BNB_REWARD_TRACKER_ADDRESS,
        undefined);
    rewardsBar.start(holders.length, 0);
    for (var i = 0; i < holders.length; i++) {
        rewardsBar.update(i + 1);
        var holder = holders[i];
        let staked: bigint = await rewardTracker.depositBalances(holder.address, MPX_BNB_ADDRESS);
        holders[i].amount = (BigInt(holder.amount) + staked).toString();
    }
    rewardsBar.stop();
}

async function snapshotMpxBnbLpHolders(): Promise<bigint> {
    let lpsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let lp = await ethers.getContractAt(
        pairAbi,
        MPX_BNB_LP_PAIR_ADDRESS,
        undefined);
    lpsBar.start(holders.length, 0);
    for (var i = 0; i < holders.length; i++) {
        lpsBar.update(i + 1);
        var holder = holders[i];
        let balance: bigint = await lp.balanceOf(holder.address);
        holders[i].amountLp = (BigInt(holder.amountLp) + balance).toString();
    }
    lpsBar.stop();
    return await lp.totalSupply();
}

async function snapshotMpxBnbLpStakers() {
    let lpsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let gauge = await ethers.getContractAt(
        gaugeAbi,
        MPX_BNB_LP_GAUGE_ADDRESS,
        undefined);
    lpsBar.start(holders.length, 0);
    for (var i = 0; i < holders.length; i++) {
        lpsBar.update(i + 1);
        var holder = holders[i];
        let staked: bigint = await gauge.balanceOf(holder.address);
        holders[i].amountLp = (BigInt(holder.amountLp) + staked).toString();
    }
    lpsBar.stop();
}

async function changeLpToMpxAmounts(totalSupply: bigint) {
    let lpPair = holders.find((h) => h.address.toLocaleLowerCase() == MPX_BNB_LP_PAIR_ADDRESS);
    let mpxInLp: bigint = BigInt(lpPair!.amount);
    for (var i = 0; i < holders.length; i++) {
        var amountLp: bigint = BigInt(holders[i].amountLp);
        var amountMpx = (amountLp * mpxInLp) / totalSupply;
        holders[i].amountLp = amountMpx.toString();
    }
}

function sortHolders(holders: MpxHolder[]) {
    holders.sort((a: MpxHolder, b: MpxHolder) => {
        let aMount: bigint = BigInt(a.amount) + BigInt(a.amountLp);
        let bMount: bigint = BigInt(b.amount) + BigInt(b.amountLp);
        if (aMount > bMount) return -1;
        else if (aMount < bMount) return 1;
        else return 0;
    })
}

async function main() {
    let snapshotBlock = await ethers.provider.getBlockNumber()
    console.log("Snapshot block:", snapshotBlock);

    try {
        console.log(`Getting MPX holders from data/mpx_bnb_raw_snapshot_${snapshotBlock}.json...`);
        let jsonHolders = await fs.readFile(`data/mpx_bnb_raw_snapshot_${snapshotBlock}.json`, 'utf8');
        holders = JSON.parse(jsonHolders) as MpxHolder[];
    } catch (err) {
        console.log("Getting MPX holders from blockchain...");
        holders = await snapshotHolders(snapshotBlock);
    }

    // Set address zero to 0 amount
    var addressZeroIndex = holders.findIndex((holder) => holder.address.toLocaleLowerCase() == ethers.ZeroAddress);
    holders[addressZeroIndex].amount = BigInt(0).toString();

    let ts = await getTotalSupply();

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    console.log("Getting MPX stakers...");
    await snapshotStakers()

    // Filter out reward tracker (staked MPX holder contract)
    holders = holders.filter((holder) => holder.address.toLocaleLowerCase() != MPX_BNB_REWARD_TRACKER_ADDRESS.toLocaleLowerCase());

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    console.log("Getting MPX-BNB LP holders...")
    let lpTs = await snapshotMpxBnbLpHolders();
    console.log("Getting MPX-BNB LP stakers...")
    await snapshotMpxBnbLpStakers();
    await changeLpToMpxAmounts(lpTs);

    // Filter out LP and Gauge
    holders = holders.filter((holder) => holder.address.toLocaleLowerCase() != MPX_BNB_LP_PAIR_ADDRESS.toLocaleLowerCase());
    holders = holders.filter((holder) => holder.address.toLocaleLowerCase() != MPX_BNB_LP_GAUGE_ADDRESS.toLocaleLowerCase());

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    // Filter out previous holders and address zero
    holders = holders.filter((holder) => BigInt(holder.amount) + BigInt(holder.amountLp) > 0);
    holders = holders.filter((holder) => holder.address.toLocaleLowerCase() != ethers.ZeroAddress);

    console.log("Saving Final JSON...")
    sortHolders(holders);
    await saveSnapshotAsJson(holders, snapshotBlock, true);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
