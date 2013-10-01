from __future__ import print_function
import os
import sys

def cumulative(file):
    for line in open(file):
        if line.startswith('Cumulative Processor Energy_0 (mWh) = '):
            return float(line.split(' = ')[1])

for base in sys.argv[1:]:
    results = [(run, cumulative('%s-run%d.csv' % (base, run)))
               for run in range(1, 6)]

    results.sort(key=lambda x: x[1])

    print('\t'.join(['%.02f' % c for r, c in results] + [base]))
