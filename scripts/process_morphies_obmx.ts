import * as fs from "node:fs/promises";

interface User {
  address: string;
  amount: string;
  ids: number[];
  isContract: boolean;
}

const totalTokens = BigInt("1000000000000000000000000000");

async function loadData(): Promise<User[]> {
  try {
    const path = "./scripts/morphies_snapshot_35519816.json";
    const jsonData = await fs.readFile(path, "utf8");
    const users: User[] = JSON.parse(jsonData);

    return users;
  } catch (error) {
    console.error("Error loading data", error);
    return [];
  }
}

function calculateAirdropAmounts(users: User[]): {
  addresses: string[];
  airdropAmounts: string[];
} {
  const totalNFTs = users.reduce(
    (sum, user) => sum + BigInt(user.amount),
    BigInt(0)
  );
  const tokenPerNFT = totalTokens / totalNFTs;

  const addresses: string[] = [];
  const airdropAmounts: string[] = [];

  users.forEach((user) => {
    addresses.push(user.address);
    airdropAmounts.push((BigInt(user.amount) * tokenPerNFT).toString());
  });

  return { addresses, airdropAmounts };
}

async function saveAirdropData(
  addresses: string[],
  airdropAmounts: string[]
): Promise<void> {
  const content = `[${addresses.join(",")}]\n\n[${airdropAmounts.join(",")}]`;

  // Prepare the JSON object with address: amount mapping
  const airdropData = addresses.reduce((acc, address, index) => {
    acc[address] = airdropAmounts[index];
    return acc;
  }, {} as Record<string, string>);

  try {
    await fs.writeFile("airdropDataArrays.txt", content, "utf8");
    console.log("Airdrop data arrays saved successfully.");

    const jsonContent = JSON.stringify(airdropData, null, 2); // Pretty print the JSON
    await fs.writeFile("airdropData.json", jsonContent, "utf8");
    console.log("Airdrop data saved successfully in JSON format.");
  } catch (error) {
    console.error("Failed to save airdrop data:", error);
  }
}

async function main() {
  const users = await loadData();
  const { addresses, airdropAmounts } = calculateAirdropAmounts(users);
  await saveAirdropData(addresses, airdropAmounts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
