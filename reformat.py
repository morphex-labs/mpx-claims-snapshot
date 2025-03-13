import json

FOLDER = "data/7_Mar-13-2025_103.5k"
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
        item["amountUsdc"] = amount_usdc
        item.pop("amount", None)
        address_lower = item.get("address", "").lower()

        if address_lower in ftm_dict:
            ftm_info = ftm_dict[address_lower]
            item["amountMpxOnFtm"] = ftm_info["amount"]
            item["amountLpOnFtm"] = ftm_info["amountLp"]

        if address_lower in bnb_dict:
            bnb_info = bnb_dict[address_lower]
            item["amountMpxOnBsc"] = bnb_info["amount"]
            item["amountLpOnBsc"] = bnb_info["amountLp"]

    with open(output_file, 'w') as f:
        json.dump(input_data, f, indent=2)


if __name__ == '__main__':
    reformat_json(INPUT_FILE, FTM_RAW_FILE, BNB_RAW_FILE, OUTPUT_FILE)
