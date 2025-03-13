import json

FOLDER = "data/7_Mar-13-2025_84k"
INPUT_FILE = f"{FOLDER}/mpx_final_snapshot_ftm_105217394_bsc_46881358.json"
FTM_RAW_FILE = f"{FOLDER}/mpx_ftm_snapshot_105217394.json"
BNB_RAW_FILE = f"{FOLDER}/mpx_bnb_snapshot_46881358.json"
OUTPUT_FILE = f"{FOLDER}/mpx_final_snapshot.json"


def reformat_json(input_file, ftm_raw_file, bnb_raw_file, output_file):
    with open(input_file, 'r') as f:
        input_data = json.load(f)

    with open(ftm_raw_file, 'r') as f:
        ftm_raw_data = json.load(f)
    ftm_dict = {}
    for item in ftm_raw_data:
        addr = item.get("address", "").lower()
        ftm_dict[addr] = {
            "amount": item.get("amount"),
            "amountLp": item.get("amountLp")
        }

    with open(bnb_raw_file, 'r') as f:
        bnb_raw_data = json.load(f)
    bnb_dict = {}
    for item in bnb_raw_data:
        addr = item.get("address", "").lower()
        bnb_dict[addr] = {
            "amount": item.get("amount"),
            "amountLp": item.get("amountLp")
        }

    for item in input_data:
        amount_usdc = float(item.get("amount", 0)) / 1e6
        item["amountUsdcAirdrop"] = amount_usdc
        percent = round(item["percent"], 6)
        item["percent"] = round(item["percent"], 6)
        item.pop("percent", 0)
        item.pop("amount", 0)
        address_lower = item.get("address", "").lower()

        ftm_info = ftm_dict.get(address_lower, {"amount": 0, "amountLp": 0})
        item["mpxOnFtm"] = round(float(ftm_info["amount"])/1e18, 2)
        item["mpxLpOnFtm"] = round(float(ftm_info["amountLp"])/1e18, 2)

        bnb_info = bnb_dict.get(address_lower, {"amount": 0, "amountLp": 0})
        item["mpxOnBsc"] = round(float(bnb_info["amount"])/1e18, 2)
        item["mpxLpOnBsc"] = round(float(bnb_info["amountLp"])/1e18, 2)

        item["percent"] = percent

    with open(output_file, 'w') as f:
        json.dump(input_data, f, indent=2)


if __name__ == '__main__':
    reformat_json(INPUT_FILE, FTM_RAW_FILE, BNB_RAW_FILE, OUTPUT_FILE)
