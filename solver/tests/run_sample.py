import json, sys, time
sys.path.insert(0, '.'); sys.path.insert(0, 'tests/stubs')
import timetable_model
from tests.sample_data import make

data = make(n_classes=int(sys.argv[1]) if len(sys.argv) > 1 else 20)
data['time_limit'] = int(sys.argv[2]) if len(sys.argv) > 2 else 60
print('check:', json.dumps(timetable_model.check(data)['stats']), [i['message'] for i in timetable_model.check(data)['issues'] if i['level']=='error'])
last = [0]
def prog(p):
    if time.time() - last[0] > 5:
        last[0] = time.time(); print('  progress', p)
r = timetable_model.solve(data, on_progress=prog)
print(r['status'], 'obj', r.get('objective'), 'bound', r.get('best_bound'), 'time', r.get('wall_time'), 'sol', r.get('solutions'))
print('score', r['score']); print('violations', r['violations']); print('diag', r['diagnostics'][:3])
# doğrulama
from collections import Counter
A = {a['id']: a for a in data['assignments']}
tc, cc, rc = Counter(), Counter(), Counter()
for l in r['lessons']:
    a = A[l['assignment_id']]
    tc[(a['teacher_id'], l['day'], l['period'])] += 1
    cc[(a['classroom_id'], l['day'], l['period'])] += 1
    if a['room_id']: rc[(a['room_id'], l['day'], l['period'])] += 1
print('lessons', len(r['lessons']), 'expected', sum(a['hours'] for a in data['assignments']))
print('teacher clash', sum(1 for v in tc.values() if v > 1), 'class clash', sum(1 for v in cc.values() if v > 1),
      'room over', sum(1 for (rid, d, p), v in rc.items() if v > {1: 1, 2: 2}[rid]))
print('teacher1 friday', sum(1 for l in r['lessons'] if A[l['assignment_id']]['teacher_id'] == 1 and l['day'] == 5))
