# clean_dates.py
import re
import csv

stop_times_re = '(24):(\d\d):(\d\d)'
replace_re = '00:$2:$3,00'

with open('../gtfs_static/stop_times.txt', 'r+') as csvfile:
    #writer = csv.writer(csvfile, delimiter=',', quotechar='"')
    reader = csv.reader(csvfile, delimiter=',', quotechar='"')
    for row in csvfile:
        print row
        #if re.match('(24):(\d\d):(\d\d)', data)
        #spamwriter.writerow(['Spam'] * 5 + ['Baked Beans'])
        #spamwriter.writerow(['Spam', 'Lovely Spam', 'Wonderful Spam'])
