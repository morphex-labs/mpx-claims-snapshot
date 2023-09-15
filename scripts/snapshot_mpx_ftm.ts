import { ethers } from "hardhat";
import mpxBnbAbi from '../abi/mpx_bnb.json';
import pairAbi from '../abi/pair.json';
import erc20Abi from '../abi/erc20.json';
import rewardTrackerAbi from '../abi/reward_tracker.json';
import gaugeAbi from '../abi/gauge_v2.json';
import * as fs from 'node:fs/promises';
import { INCREMENT, MPX_FTM_ADDRESS, MPX_FTM_CREATE_BLOCK, MPX_FTM_EQL_LP_GAUGE_ADDRESS, MPX_FTM_EQL_LP_PAIR_ADDRESS, MPX_FTM_EQL_LP_PAIR_CREATE_BLOCK, MPX_FTM_FVM_LP_GAUGE_ADDRESS, MPX_FTM_FVM_LP_PAIR_ADDRESS, MPX_FTM_FVM_LP_PAIR_CREATE_BLOCK, MPX_FTM_REWARD_TRACKER_ADDRESS, MPX_FTM_REWARD_TRACKER_CREATE_BLOCK, MpxHolder } from "../utils/constants";
import { BigNumberish, EventLog } from "ethers";
import { retry } from "../utils/helpers";
const cliProgress = require('cli-progress');

var balances: { [id: string]: bigint; } = {}
var holders: MpxHolder[] = [];
var tmpHolders: MpxHolder[] = [];

async function snapshotERC20(tokenAddress: string, tokenCreationBlock: number, snapshotBlock: number, accounts: MpxHolder[]) {
    let progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    let token = await ethers.getContractAt(
        erc20Abi,
        tokenAddress,
        undefined);

    progressBar.start(snapshotBlock - tokenCreationBlock, 0);

    let filter = token.filters.Transfer();
    let increment = INCREMENT;
    var accountsInteracted: Set<string> = new Set<string>();

    try {
        for (var i = tokenCreationBlock; i < snapshotBlock; i = i + increment + 1) {
            progressBar.update(i + increment + 1 - tokenCreationBlock);
            var end = i + increment;
            if (end >= snapshotBlock) end = snapshotBlock;
            var events = await retry(3, token.queryFilter(filter, i, end)) as EventLog[];
            events.forEach((event) => {
                accountsInteracted.add(event.args.from);
                accountsInteracted.add(event.args.to);
            });
        }
        console.log("Events processed");
    } catch (e: any) {
        console.log(e.message);
        throw e;
    } finally {
        progressBar.stop();

        var counter = 0;
        for (let account of accountsInteracted) {
            let index = accounts.findIndex((h) => h.address.toLowerCase() == account.toLowerCase());
            if (index == -1) {
                counter++;
                accounts.push({ address: account, amount: BigInt(0).toString(), amountLp: BigInt(0).toString() })
            }
        }
        console.log(`Found ${counter} new accounts`)
    }
}

async function snapshotHolders(snapshotBlock: number): Promise<MpxHolder[]> {
    // create a new progress bar instance and use shades_classic theme
    console.log("Processing transfer events...");
    let mpxBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let mpx = await ethers.getContractAt(
        mpxBnbAbi,
        MPX_FTM_ADDRESS,
        undefined);
    mpxBar.start(snapshotBlock - MPX_FTM_CREATE_BLOCK, 0);
    let filter = mpx.filters.Transfer();
    let increment = INCREMENT;

    try {
        for (var i = MPX_FTM_CREATE_BLOCK; i < snapshotBlock; i = i + increment + 1) {
            mpxBar.update(i + increment + 1 - MPX_FTM_CREATE_BLOCK);
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
        return mpxHolders;
    }
}

async function saveSnapshotAsJson(data: MpxHolder[], snapshotBlock: BigNumberish, final: boolean = false) {
    let ownersJson = JSON.stringify(data);
    let path = final ? `data/mpx_ftm_snapshot_${snapshotBlock}.json` : `data/mpx_ftm_raw_snapshot_${snapshotBlock}.json`;
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
        MPX_FTM_ADDRESS,
        undefined);
    return await mpx.totalSupply();
}

async function snapshotStakers() {
    let rewardsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let rewardTracker = await ethers.getContractAt(
        rewardTrackerAbi,
        MPX_FTM_REWARD_TRACKER_ADDRESS,
        undefined);
    rewardsBar.start(holders.length, 0);
    for (var i = 0; i < holders.length; i++) {
        rewardsBar.update(i + 1);
        var holder = holders[i];
        let staked: bigint = await rewardTracker.depositBalances(holder.address, MPX_FTM_ADDRESS);
        holders[i].amount = (BigInt(holder.amount) + staked).toString();
    }
    rewardsBar.stop();
}

async function snapshotLPPair(pairAddress: string, accounts: MpxHolder[]): Promise<bigint> {
    let lpsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let lp = await ethers.getContractAt(
        pairAbi,
        pairAddress,
        undefined);
    lpsBar.start(accounts.length, 0);
    for (var i = 0; i < accounts.length; i++) {
        lpsBar.update(i + 1);
        var holder = accounts[i];
        let balance: bigint = await lp.balanceOf(holder.address);
        accounts[i].amountLp = (BigInt(holder.amountLp) + balance).toString();
    }
    lpsBar.stop();
    return await lp.totalSupply();
}

async function snapshotLpGauge(gaugeAddress: string, accounts: MpxHolder[]) {
    let lpsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let gauge = await ethers.getContractAt(
        gaugeAbi,
        gaugeAddress,
        undefined);
    lpsBar.start(accounts.length, 0);
    for (var i = 0; i < accounts.length; i++) {
        lpsBar.update(i + 1);
        var holder = accounts[i];
        let staked: bigint = await gauge.balanceOf(holder.address);
        accounts[i].amountLp = (BigInt(holder.amountLp) + staked).toString();
    }
    lpsBar.stop();
}

async function changeLpToMpxAmounts(pairAddress: string, totalSupply: bigint, accounts: MpxHolder[]) {
    let lpPair = holders.find((h) => h.address.toLowerCase() == pairAddress.toLowerCase());
    let mpxInLp: bigint = BigInt(lpPair!.amount);
    console.log(mpxInLp);
    for (var i = 0; i < accounts.length; i++) {
        var amountLp: bigint = BigInt(accounts[i].amountLp);
        var amountMpx = (amountLp * mpxInLp) / totalSupply;
        accounts[i].amountLp = amountMpx.toString();
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
        let path = `data/mpx_ftm_raw_snapshot_${snapshotBlock}.json`;
        console.log(`Getting MPX holders from ${path}...`);
        let jsonHolders = await fs.readFile(path, 'utf8');
        holders = JSON.parse(jsonHolders) as MpxHolder[];
    } catch (err) {
        console.log(err)
        console.log("Getting MPX holders from blockchain...");
        holders = await snapshotHolders(snapshotBlock);
        await saveSnapshotAsJson(holders, snapshotBlock);
    }

    // Set address zero to 0 amount
    var addressZeroIndex = holders.findIndex((holder) => holder.address.toLocaleLowerCase() == ethers.ZeroAddress);
    holders[addressZeroIndex].amount = BigInt(0).toString();

    let ts = await getTotalSupply();

    console.log("Checking Snapshot data...");
    checkSnapshotCorrectness(holders, ts);

    console.log("Getting MPX stakers...");
    await snapshotERC20(MPX_FTM_REWARD_TRACKER_ADDRESS, MPX_FTM_REWARD_TRACKER_CREATE_BLOCK, snapshotBlock, holders);
    await snapshotStakers();

    // Filter out reward tracker (staked MPX holder contract)
    holders = holders.filter((holder) => holder.address.toLocaleLowerCase() != MPX_FTM_REWARD_TRACKER_ADDRESS.toLocaleLowerCase());

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    console.log("Getting MPX-FTM (FVM) LP holders...")
    await snapshotERC20(MPX_FTM_FVM_LP_PAIR_ADDRESS, MPX_FTM_FVM_LP_PAIR_CREATE_BLOCK, snapshotBlock, holders);
    let lpTs = await snapshotLPPair(MPX_FTM_FVM_LP_PAIR_ADDRESS, holders);

    console.log("Getting MPX-FTM (FVM) LP stakers...")
    await snapshotLpGauge(MPX_FTM_FVM_LP_GAUGE_ADDRESS, holders);
    await changeLpToMpxAmounts(MPX_FTM_FVM_LP_PAIR_ADDRESS, lpTs, holders);

    // Filter out LP and Gauge (only amountLp)
    holders = holders.filter((holder) => holder.address.toLowerCase() != MPX_FTM_FVM_LP_PAIR_ADDRESS.toLowerCase());
    holders.find((holder) => holder.address.toLowerCase() == MPX_FTM_FVM_LP_GAUGE_ADDRESS.toLowerCase())!.amountLp = BigInt(0).toString();

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    console.log("Getting MPX-FTM (EQL) LP holders...")
    await snapshotERC20(MPX_FTM_EQL_LP_PAIR_ADDRESS, MPX_FTM_EQL_LP_PAIR_CREATE_BLOCK, snapshotBlock, tmpHolders);
    let lpTsEq = await snapshotLPPair(MPX_FTM_EQL_LP_PAIR_ADDRESS, tmpHolders);

    console.log("Getting MPX-FTM (EQL) LP stakers...")
    await snapshotLpGauge(MPX_FTM_EQL_LP_GAUGE_ADDRESS, tmpHolders);
    await changeLpToMpxAmounts(MPX_FTM_EQL_LP_PAIR_ADDRESS, lpTsEq, tmpHolders);

    var sum = BigInt(0);
    console.log("len", holders.length);
    for (var i in tmpHolders) {
        let index = holders.findIndex((h) => h.address.toLowerCase() == tmpHolders[i].address.toLowerCase());
        sum = sum + BigInt(tmpHolders[i].amountLp);
        if (index == -1) {
            holders.push({ address: tmpHolders[i].address, amount: BigInt(0).toString(), amountLp: tmpHolders[i].amountLp })
        } else {
            holders[index].amountLp = (BigInt(holders[index].amountLp) + BigInt(tmpHolders[i].amountLp)).toString();
        }
    }

    // Filter out LP and Gauge (only amountLp)
    holders = holders.filter((holder) => holder.address.toLowerCase() != MPX_FTM_EQL_LP_PAIR_ADDRESS.toLowerCase());
    holders.find((holder) => holder.address.toLowerCase() == MPX_FTM_EQL_LP_GAUGE_ADDRESS.toLowerCase())!.amountLp = BigInt(0).toString();

    console.log("Checking Snapshot data...")
    checkSnapshotCorrectness(holders, ts);

    // Filter out previous holders and address zero
    holders = holders.filter((holder) => BigInt(holder.amount) + BigInt(holder.amountLp) > 0);
    holders = holders.filter((holder) => holder.address.toLowerCase() != ethers.ZeroAddress);

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
