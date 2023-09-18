import { ethers } from "ethers";

export const MORPHIES_ADDRESS = "0x2183765B7F1CD9B6dc7d12a936B4d31110ee4225";
export const MORPHIES_STAKING_ADDRESS = "0x13dCae96Ad6921CeD276971262641cC30DaBaAbb";

export const MPX_BNB_ADDRESS = "0x94C6B279b5df54b335aE51866d6E2A56BF5Ef9b7";
export const MPX_FTM_ADDRESS = "0x66eed5ff1701e6ed8470dc391f05e27b1d0657eb";
export const MPX_FTM_AXELAR_GATEWAY_ADDRESS = "0x304acf330bbE08d1e512eefaa92F6a57871fD895";
export const MPX_BNB_LP_PAIR_ADDRESS = "0x51bfc6e47c96d2b8c564b0ddd2c44fc03707cdc7";
export const MPX_FTM_FVM_LP_PAIR_ADDRESS = "0xF8eed2665FD11a8431fc41b2582fD5E72a1606f0";
export const MPX_FTM_EQL_LP_PAIR_ADDRESS = "0xdE26e98d868FE02fFfb6DF26E638995124d3Ca13";
export const MPX_BNB_LP_GAUGE_ADDRESS = "0x0d739cE843d0584aAE800f54685d1fa69cEC1190";
export const MPX_FTM_FVM_LP_GAUGE_ADDRESS = "0xF89f367E0225fE68c7c28Fad0BaDc7f569987cFe";
export const MPX_FTM_EQL_LP_GAUGE_ADDRESS = "0x7778a0B4688321c4E705d4e9F1A072f6F1579Bf8";
export const MPX_BNB_REWARD_TRACKER_ADDRESS = "0x13d2bBAE955c54Ab99F71Ff70833dE64482519B1";
export const MPX_FTM_REWARD_TRACKER_ADDRESS = "0xa4157E273D88ff16B3d8Df68894e1fd809DbC007";
export const MPX_BNB_REWARD_ROUTER_V2_ADDRESS = "0x9Ac78C583bD14370248Fb65C151D33CF21c1f4E4";
export const MPX_FTM_REWARD_ROUTER_V2_ADDRESS = "0xd6489eAf13f61822356F30618E1D9947fa1Ef46F";

export const MPX_BNB_BLACKLIST = [
    "0xab646b35F8Ca5d73B52E6Bc02922aC3D8333F364", // multisig
    "0x441CacA1C57c5389Dbb9955ddb92AF288Da38737", // multisig
    "0x42e5104dA4043efd5607A7766a58b0684EDFe0F7", // multisig
    "0xDd257d090FA0f9ffB496b790844418593e969ba6", // multisig
    "0x000000000000000000000000000000000000dEaD", // dead address
    ethers.ZeroAddress
]

export const MPX_FTM_BLACKLIST = [
    "0xab646b35F8Ca5d73B52E6Bc02922aC3D8333F364", // multisig
    "0x441CacA1C57c5389Dbb9955ddb92AF288Da38737", // multisig
    "0x42e5104dA4043efd5607A7766a58b0684EDFe0F7", // multisig
    "0xDd257d090FA0f9ffB496b790844418593e969ba6", // multisig
    "0x000000000000000000000000000000000000dEaD", // dead address
    ethers.ZeroAddress
]

export const MPX_BNB_CREATE_BLOCK = 28904155;
export const MPX_FTM_CREATE_BLOCK = 54647659;
export const MPX_FTM_REWARD_ROUTER_CREATE_BLOCK = 66187188;
export const MPX_FTM_REWARD_TRACKER_CREATE_BLOCK = 56916275;
export const MPX_FTM_FVM_LP_PAIR_CREATE_BLOCK = 65080466;
export const MPX_FTM_EQL_LP_PAIR_CREATE_BLOCK = 55091519;
export const INCREMENT = 1000;

export type AirdropReceiver = {
    address: string;
    percent: number;
    amount: bigint;
};

export type AirdropReceiverFormatted = {
    address: string;
    percent: number;
    amount: string;
};

export type Holder = {
    address: string;
    amount: number;
    ids: number[];
    isContract: Boolean;
};

export type MpxHolder = {
    address: string;
    amount: string;
    amountLp: string;
    isContract: Boolean;
}