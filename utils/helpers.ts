import { ethers } from "hardhat";
import { INCREMENT, MpxHolder } from "./constants";
import erc20Abi from '../abi/erc20.json';
import { EventLog } from "ethers";
const cliProgress = require('cli-progress');

export async function retry<Type>(retries: number, promise: Promise<Type>): Promise<Type> {
    try {
        const result = await promise;
        return result;
    } catch (e: any) {
        console.log(e.message);
        console.log("Retrying...");
        if (retries > 0) {
            await new Promise(f => setTimeout(f, 10000));
            return retry(retries - 1, promise);
        } else {
            throw e;
        }
    }
}

export async function markContracts(accounts: MpxHolder[]) {
    let progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(accounts.length, 0);
    try {
        for (var i = 0; i < accounts.length; i++) {
            progressBar.update(i + 1);
            let code = await ethers.provider.getCode(accounts[i].address);
            if (code != "0x") {
                accounts[i].isContract = true;
            }
        }
    } catch (err) {
        console.log(err);
    } finally {
        progressBar.stop();
    }
}

export async function snapshotERC20(tokenAddress: string, tokenCreationBlock: number, snapshotBlock: number, accounts: MpxHolder[]) {
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
                accounts.push({ address: account, amount: BigInt(0).toString(), amountLp: BigInt(0).toString(), isContract: false })
            }
        }
        console.log(`Found ${counter} new accounts`)
    }
}