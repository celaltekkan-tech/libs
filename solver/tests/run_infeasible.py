import sys; sys.path.insert(0, '.'); sys.path.insert(0, 'tests/stubs')
import timetable_model
from tests.sample_data import make
d = make(n_classes=5); d['time_limit'] = 20
d['constraints'].append({'id': 99, 'type': 'teacher_max_daily_hours', 'hard': True, 'params': {'teacher_id': 1, 'max': 2}})
r = timetable_model.solve(d)
print(r['status'], r['diagnostics'][:2])
