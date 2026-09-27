"""Zaman tablosu, ortak öğretmen, B1/B2 ve yeni kısıt türleri için doğrulama.

Çalıştırma: .venv/Scripts/python.exe tests/run_features.py
"""
import sys
from collections import Counter, defaultdict

sys.path.insert(0, '.')
sys.path.insert(0, 'tests/stubs')
import timetable_model  # noqa: E402
from tests.sample_data import make  # noqa: E402

FAILED = []


def expect(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        FAILED.append(msg)


def solve(data, limit=20):
    data['time_limit'] = limit
    r = timetable_model.solve(data)
    expect(r['status'] in ('OPTIMAL', 'FEASIBLE'), f"çözüm bulundu ({r['status']}) {r['diagnostics'][:1]}")
    return r


def by_assignment(data, r):
    A = {a['id']: a for a in data['assignments']}
    out = defaultdict(list)
    for l in r['lessons']:
        out[l['assignment_id']].append((l['day'], l['period']))
    return A, out


# 1) Zaman tablosu + ortak öğretmen
data = make(n_classes=6)
data['constraints'] = []
t_extra = max(t['id'] for t in data['teachers']) + 1
data['teachers'].append({'id': t_extra, 'name': 'Ortak Öğr.'})
co = data['assignments'][0]  # 1. şube Matematik
co['teacher_ids'] = [t_extra]
data['availability'] = [
    {'type': 'school', 'id': 0, 'closed': [[5, 8]], 'avoid': []},
    {'type': 'teacher', 'id': t_extra, 'closed': [[1, p] for p in range(1, 9)], 'avoid': []},
    {'type': 'classroom', 'id': 2, 'closed': [[2, 1]], 'avoid': [[3, 1], [3, 2]]},
    {'type': 'subject', 'id': 11, 'closed': [[d, 1] for d in range(1, 6)], 'avoid': []},
]
r = solve(data)
A, les = by_assignment(data, r)
expect(not any(p == (5, 8) for v in les.values() for p in v), 'okul kapalı hücresi (Cuma 8) boş')
expect(not any(d == 1 for d, _ in les[co['id']]), 'ortak öğretmenin kapalı günü (Pazartesi) Matematik yok')
tc = Counter()
for aid, cells in les.items():
    for tid in {A[aid]['teacher_id'], *(A[aid].get('teacher_ids') or [])}:
        for c in cells:
            tc[(tid, c)] += 1
expect(all(v == 1 for v in tc.values()), 'ortak öğretmen dahil öğretmen çakışması yok')
expect(not any(A[aid]['classroom_id'] == 2 and c == (2, 1) for aid, v in les.items() for c in v), 'şube kapalı hücresi boş')
expect(not any(A[aid]['subject_id'] == 11 and c[1] == 1 for aid, v in les.items() for c in v), 'ders kapalı saatlerinde (1. saat) Beden yok')

# 2) B1 bölünebilirlik: 4 gün, öğretmen her gün yalnız 1. saatte açık -> 2+2 ancak 1+1+1+1 olarak yerleşir
data = {
    'days': [1, 2, 3, 4], 'periods': 6, 'lunch_after': None, 'max_subject_daily': 2,
    'classrooms': [{'id': 1, 'label': '9/A'}], 'teachers': [{'id': 1, 'name': 'T'}],
    'rooms': [], 'subjects': [{'id': 1, 'name': 'Mat'}],
    'assignments': [{'id': 1, 'classroom_id': 1, 'subject_id': 1, 'teacher_id': 1, 'hours': 4,
                     'blocks': [2, 2], 'allow_split': True}],
    'constraints': [], 'locked': [],
    'availability': [{'type': 'teacher', 'id': 1,
                      'closed': [[d, p] for d in (1, 2, 3, 4) for p in range(2, 7)]}],
}
r = solve(data)
expect(len(r['lessons']) == 4, f"B1: 4 saat yerleşti ({len(r['lessons'])})")
expect(r['score'].get('block_flex', 0) > 0, 'B1: bölme cezası puanda görünüyor')
data['assignments'][0]['allow_split'] = False
r2 = timetable_model.solve({**data, 'time_limit': 10})
expect(r2['status'] in ('INFEASIBLE', 'INVALID'), f"B1 kapalıyken çözümsüz ({r2['status']})")

# 3) Aynı güne gelmesin / aynı gün olsun
data = make(n_classes=4)
data['constraints'] = [
    {'id': 10, 'type': 'subjects_not_same_day', 'hard': True, 'params': {'subject_ids': [3, 4]}},
    {'id': 11, 'type': 'subjects_same_day', 'hard': True, 'params': {'subject_ids': [6, 7], 'classroom_id': 1}},
]
r = solve(data)
A, les = by_assignment(data, r)
days = defaultdict(set)
for aid, cells in les.items():
    for d, _ in cells:
        days[(A[aid]['classroom_id'], A[aid]['subject_id'])].add(d)
expect(all(not (days[(c, 3)] & days[(c, 4)]) for c in range(1, 5)), 'Fizik ile Kimya aynı güne gelmedi')
expect(days[(1, 6)] == days[(1, 7)], f"1. şubede Tarih ve Coğrafya aynı gün ({days[(1, 6)]} / {days[(1, 7)]})")

# 4) Öğle arasını aşan blok + öğle arasıyla bölünmesin
data = make(n_classes=4)
data['constraints'] = [{'id': 20, 'type': 'subject_no_lunch_split', 'hard': True, 'params': {'subject_ids': [1]}}]
data['block_across_lunch'] = True
data['class_lunch'] = {'2': 5}
r = solve(data)
A, les = by_assignment(data, r)


def crosses(cells, lunch):
    s = set(cells)
    return any((d, lunch) in s and (d, lunch + 1) in s for d, _ in cells)


mat = [aid for aid, a in A.items() if a['subject_id'] == 1]
expect(not any(crosses(les[aid], 5 if A[aid]['classroom_id'] == 2 else 4) for aid in mat),
       'Matematik blokları öğle arasıyla bölünmedi (şubeye özel öğle arası dahil)')

# 5) Ön kontrol: zaman tablosu kapasite hatası
data = make(n_classes=2)
t1 = data['assignments'][0]['teacher_id']
data['availability'] = [{'type': 'teacher', 'id': t1, 'closed': [[d, p] for d in range(1, 6) for p in range(1, 8)]}]
chk = timetable_model.check(data)
expect(not chk['ok'] and any('müsait' in i['message'] for i in chk['issues']), 'ön kontrol: öğretmen açık saat yetersiz')

# 6) Seçmeliler: 40 saatlik haftada 36 saat çekirdek + aynı gruptan 4'er saatlik iki seçmeli.
#    Aynı gruptalarsa paralel işlenir (sığar); öğrenci ikisini birden alıyorsa sığmaz.
def elective_case(groups, profiles=None):
    subjects = [{'id': i, 'name': f'D{i}'} for i in range(1, 12)]
    assignments = []
    hours = [4, 4, 4, 4, 4, 4, 4, 4, 4]  # 9 çekirdek ders = 36 saat
    for i, h in enumerate(hours, start=1):
        assignments.append({'id': i, 'classroom_id': 1, 'subject_id': i, 'teacher_id': i, 'hours': h, 'blocks': [2, 2]})
    assignments.append({'id': 10, 'classroom_id': 1, 'subject_id': 10, 'teacher_id': 10, 'hours': 4, 'blocks': [2, 2],
                        'elective_group': groups[0]})
    assignments.append({'id': 11, 'classroom_id': 1, 'subject_id': 11, 'teacher_id': 11, 'hours': 4, 'blocks': [2, 2],
                        'elective_group': groups[1]})
    d = {'days': [1, 2, 3, 4, 5], 'periods': 8, 'lunch_after': None, 'max_subject_daily': 2,
         'classrooms': [{'id': 1, 'label': '9/A'}], 'teachers': [{'id': i, 'name': f'T{i}'} for i in range(1, 12)],
         'rooms': [], 'subjects': subjects, 'assignments': assignments, 'constraints': [], 'locked': [],
         'weights': {'class_compact': 0, 'teacher_gaps': 0, 'teacher_single_hour_day': 0}}
    if profiles is not None:
        d['elective_profiles'] = {'1': profiles}
    return d


data = elective_case(['SEC', 'SEC'])
expect(timetable_model.check(data)['ok'], 'aynı seçmeli grubu: ön kontrol 40 saate sığıyor')
r = solve(data)
A, les = by_assignment(data, r)
expect(set(les[10]) == set(les[11]), 'aynı gruptaki seçmeliler paralel işlendi')
data = elective_case(['SEC1', 'SEC2'])
expect(not timetable_model.check(data)['ok'], 'farklı seçmeli grupları: 44 saat sığmıyor (ön kontrol hatası)')
data = elective_case(['SEC', 'SEC'], profiles=[[10], [11]])
expect(timetable_model.check(data)['ok'], 'öğrenci profilleri ayrı: sığıyor')
data = elective_case(['SEC', 'SEC'], profiles=[[10], [10, 11]])
expect(not timetable_model.check(data)['ok'], 'bir öğrenci iki seçmeliyi de alıyor: sığmıyor')
data = elective_case(['SEC', 'SEC'], profiles=[[10]])
chk = timetable_model.check(data)
expect(any('seçen öğrenci' in i['message'] for i in chk['issues']), 'seçeni olmayan seçmeli uyarısı')

print('\n' + ('TÜMÜ GEÇTİ' if not FAILED else f'{len(FAILED)} HATA'))
sys.exit(1 if FAILED else 0)
