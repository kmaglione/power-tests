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

    new_base = '%s-run%d' % (base, results[2][0])
    for ext in 'csv', 'json':
        os.link('%s.%s' % (new_base, ext),
                '%s.%s' % (base, ext))
