export const MORPHIES_ADDRESS = "0x2183765B7F1CD9B6dc7d12a936B4d31110ee4225";
export const STAKING_ADDRESS = "0x13dCae96Ad6921CeD276971262641cC30DaBaAbb";
export const MPX_BNB_ADDRESS = "0x94C6B279b5df54b335aE51866d6E2A56BF5Ef9b7";
export const MPX_BNB_CREATE_BLOCK = 28904155;
export const INCREMENT = 1000;


export type Holder = {
    address: string;
    amount: number;
    ids: number[];
};

export type MpxHolder = {
    address: string;
    amount: string;
}

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