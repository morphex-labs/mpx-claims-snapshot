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