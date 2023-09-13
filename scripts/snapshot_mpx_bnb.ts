import { ethers } from "hardhat";
import mpxBnbAbi from '../abi/mpx_bnb.json';
import * as fs from 'node:fs/promises';
import { INCREMENT, MPX_BNB_ADDRESS, MPX_BNB_CREATE_BLOCK, MpxHolder, retry } from "./helpers";
import { BigNumberish, EventLog } from "ethers";
const cliProgress = require('cli-progress');

// MPX single staked & held in wallet for both Fantom and BSC. 
// MPX-FTM LPs on FVM and Equalizer
// MPX-BNB on Thena

var balances: { [id: string]: bigint; } = {}

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
            mpxHolders.push({ address: key, amount: balances[key].toString() });
        }

        mpxHolders.sort((a: MpxHolder, b: MpxHolder) => {
            if (BigInt(a.amount) > BigInt(b.amount)) return -1;
            else if (BigInt(a.amount) < BigInt(b.amount)) return 1;
            else return 0;
        })

        await saveSnapshotAsJson(mpxHolders, snapshotBlock);

        return { mpxHolders, totalSupply };
    }
}

async function saveSnapshotAsJson(data: MpxHolder[], snapshotBlock: BigNumberish) {
    let ownersJson = JSON.stringify(data);
    await fs.writeFile(`data/mpx_bnb_raw_snapshot_${snapshotBlock}.json`, ownersJson);
    console.log(`Snapshot saved as data/mpx_bnb_raw_snapshot_${snapshotBlock}.json`);
}

function checkSnapshotCorrectness(data: MpxHolder[], totalSupply: bigint) {
    var sum = BigInt(0);
    for (var i = 0; i < data.length; i++) {
        sum += BigInt(data[i].amount);
    }
    if (sum != totalSupply) {
        console.log("MPX sum doesn't match");
        console.log("Expected:", totalSupply);
        console.log("Checked:", sum);
        return -1;
    }
    console.log("Snapshot data is OK");
}

async function getTotalSupply(): Promise<bigint> {
    let mpx = await ethers.getContractAt(
        mpxBnbAbi,
        MPX_BNB_ADDRESS,
        undefined);
    return await mpx.totalSupply();
}

async function main() {
    let snapshotBlock = await ethers.provider.getBlockNumber()
    console.log("Snapshot block:", snapshotBlock);

    var holders: MpxHolder[] = [];

    try {
        console.log(`Getting MPX holders from data/mpx_bnb_raw_snapshot_${snapshotBlock}.json...`);
        let jsonHolders = await fs.readFile(`data/mpx_bnb_raw_snapshot_${snapshotBlock}.json`, 'utf8');
        holders = JSON.parse(jsonHolders) as MpxHolder[];
    } catch (err) {
        console.log("Getting MPX holders from blockchain...");
        holders = await snapshotHolders(snapshotBlock);
    }

    // Filter out previous holders and address zero
    holders = holders.filter((holder) => BigInt(holder.amount) > 0);
    holders = holders.filter((holder) => holder.address != ethers.ZeroAddress);

    console.log("Checking Snapshot data...")
    let ts = await getTotalSupply();
    checkSnapshotCorrectness(holders, ts);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
