import * as fs from 'node:fs/promises';

export const MORPHIES_ADDRESS = "0x2183765B7F1CD9B6dc7d12a936B4d31110ee4225";
export const STAKING_ADDRESS = "0x13dCae96Ad6921CeD276971262641cC30DaBaAbb";

export type Holder = {
    address: string;
    amount: number;
    ids: number[];
};