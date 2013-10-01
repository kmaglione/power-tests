from __future__ import print_function
from collections import defaultdict
import csv
import json
import os
import sys

def dictify(filename, parse, filter=lambda r: True):
    res = defaultdict(list)

    for row in csv.reader(open(filename, 'r')):
        r = parse(row[:1] + row[2:])
        if filter(r):
            res[row[1]].append(r)

    return res

def power_rows(filename):
    for n, row in enumerate(csv.reader(open(filename, 'r'))):
        if len(row) == 0:
            return

        if n > 0:
            yield row

for base in sys.argv[1:]:
    print(base)

    data = json.load(open('%s.json' % base))

    data['power_usage'] = [(int(float(r[2]) * 1000),
                            float(r[4]),
                            float(r[6]))
                           for r in power_rows('%s.csv' % base)]

    data['process_cpu_percentage'] = dictify('xperf-%d.csv' % data['pid'],
                                             lambda r: (int(r[0]) / 100, float(r[1])),
                                             lambda r: r[1])

    data['process_cpu_samples'] = dictify('xperf-samples-%d.csv' % data['pid'],
                                          lambda r: int(r[0]))

    json.dump(data, open('%s-combined.json' % base, 'w'));
