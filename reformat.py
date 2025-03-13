import json
import argparse


def reformat_json(input_file, output_file):
    with open(input_file, 'r') as f:
        data = json.load(f)

    for item in data:
        item['amount'] = float(item['amount']) / 1e6

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Reformat JSON file.')
    parser.add_argument('input_file', type=str, help='Path to the input JSON file.')
    parser.add_argument('output_file', type=str, help='Path to the output JSON file.')

    args = parser.parse_args()

    reformat_json(args.input_file, args.output_file)
