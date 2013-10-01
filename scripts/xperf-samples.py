from __future__ import print_function
from collections import defaultdict
from itertools import chain
import csv
import operator
import sys

output = None
pid = None
start_time = None

for line in csv.reader(open(sys.argv[1], 'r')):
    if not line:
        continue

    line = tuple(map(str.strip, line))

    if line[0] == 'SampledProfile':
        if output is not None:
            rowpid = line[2]

            output.writerow((int(line[1]) - start_time,
                             line[2]))

    elif line[0] == 'P-Start' and line[2].startswith('firefox.exe ('):
        pid = line[2]
        pid_num = int(pid[len('firefox.exe ('):pid.index(')')])
        start_time = int(line[1])
        output = csv.writer(open('xperf-samples-%d.csv' % pid_num, 'w'))

    elif line[0] == 'P-End':
        if line[2] == pid:
            output = None
            pid = None
