import json
import argparse


def reformat_json(input_file, raw_file, output_file):
    with open(input_file, 'r') as f:
        input_data = json.load(f)

    with open(raw_file, 'r') as f:
        raw_data = json.load(f)
    raw_dict = {}
    for item in raw_data:
        addr = item.get("address", "").lower()
        raw_dict[addr] = {
            "amount": item.get("amount"),
            "amountLp": item.get("amountLp")
        }

    for item in input_data:
        amount_usdc = float(item.get("amount", 0)) / 1e6
        item["amountUsdc"] = amount_usdc
        item.pop("amount", None)

        address_lower = item.get("address", "").lower()
        if address_lower in raw_dict:
            raw_info = raw_dict[address_lower]
            item["amountMpx"] = raw_info["amount"]
            item["amountLp"] = raw_info["amountLp"]

    with open(output_file, 'w') as f:
        json.dump(input_data, f, indent=2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Reformat JSON file.')
    parser.add_argument('input_file', type=str, help='Path to the input JSON file.')
    parser.add_argument('raw_file', type=str, help='Path to the raw JSON file for enrichment.')
    parser.add_argument('output_file', type=str, help='Path to the output JSON file.')

    args = parser.parse_args()
    reformat_json(args.input_file, args.raw_file, args.output_file)
