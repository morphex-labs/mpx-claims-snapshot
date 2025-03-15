import json

FILE_PATH = "data/mpx_final_snapshot.json"  # /7_Mar-13-2025_141k


def sum_test(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)

    sums = {}

    for item in data:
        for key, value in item.items():
            if isinstance(value, (int, float)):
                sums[key] = sums.get(key, 0) + value

    return sums


if __name__ == '__main__':
    sums = sum_test(FILE_PATH)
    for key, total in sums.items():
        print(f'{key}: {total}')
    print(f"Total MPX: {sums['mpxOnFtm']+sums['mpxLpOnFtm']+sums['mpxOnBsc']+sums['mpxLpOnBsc']+sums['esmpxOnFtm']/2}")
