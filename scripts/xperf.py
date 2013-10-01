from __future__ import print_function
from collections import defaultdict
from itertools import chain
import csv
import operator
import sys

data = None
pid = None
start_time = None

def dump_data():
    output = csv.writer(open('xperf-%d.csv' % pid_num, 'w'))

    times   = defaultdict(lambda: defaultdict(lambda: 0))
    samples = defaultdict(lambda: 0)
    procs   = defaultdict(lambda: 0)

    for time, proc in data:
        time = int(round(time / 1000 / 1000))

        samples[time] += 1
        if proc != pid and not proc.startswith('Idle ('):
            procs[proc] += 1
            times[time][proc] += 1

    procnames = sorted(procs.keys(), lambda a, b: procs[a] - procs[b])

    for time in sorted(times.keys()):
        for proc in procnames:
            cpu = round((float(times[time].get(proc, 0)) / samples[time]) * 100)
            output.writerow((time * 1000,
                             proc,
                             cpu))

for line in csv.reader(open(sys.argv[1], 'r')):
    if not line:
        continue

    line = tuple(map(str.strip, line))

    if line[0] == 'SampledProfile':
        if data is not None:
            data.append((int(line[1]) - start_time,
                         line[2]))

    elif line[0] == 'P-Start' and line[2].startswith('firefox.exe ('):
        pid = line[2]
        pid_num = int(pid[len('firefox.exe ('):pid.index(')')])
        start_time = int(line[1])
        data = []

    elif line[0] == 'P-End':
        if line[2] == pid:
            dump_data()
            data = None
            pid = None
