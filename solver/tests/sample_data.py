"""Gerçekçi bir lise örneği: 20 şube, haftada 35 saat, 5 gün x 8 saat."""
import random

SUBJECTS = [  # (id, ad, saat, zor, mekan)
    (1, 'Matematik', 6, True, None), (2, 'Edebiyat', 5, True, None), (3, 'Fizik', 2, True, 1),
    (4, 'Kimya', 2, True, None), (5, 'Biyoloji', 2, False, None), (6, 'Tarih', 2, False, None),
    (7, 'Coğrafya', 2, False, None), (8, 'İngilizce', 4, False, None), (9, 'Almanca', 2, False, None),
    (10, 'Din Kültürü', 2, False, None), (11, 'Beden Eğitimi', 2, False, 2), (12, 'Görsel Sanatlar', 2, False, None),
    (13, 'Felsefe', 2, False, None),
]


def make(n_classes=20, seed=1, max_teacher_hours=22):
    rnd = random.Random(seed)
    classrooms = [{'id': i + 1, 'label': f'{9 + i // 5}/{"ABCDE"[i % 5]}'} for i in range(n_classes)]
    teachers, assignments = [], []
    tid, aid = 1, 1
    for sid, name, hours, hard, room in SUBJECTS:
        load, cur = 0, None
        for c in classrooms:
            if cur is None or load + hours > max_teacher_hours:
                cur = tid
                teachers.append({'id': tid, 'name': f'{name} Öğr. {tid}'})
                tid += 1
                load = 0
            load += hours
            assignments.append({'id': aid, 'classroom_id': c['id'], 'subject_id': sid, 'teacher_id': cur,
                                'hours': hours, 'blocks': None, 'room_id': room, 'sync_group': None})
            aid += 1
    return {
        'days': [1, 2, 3, 4, 5], 'periods': 8, 'lunch_after': 4, 'time_limit': 60, 'workers': 8,
        'max_subject_daily': 2,
        'classrooms': classrooms, 'teachers': teachers,
        'rooms': [{'id': 1, 'name': 'Fizik Lab', 'capacity': 1}, {'id': 2, 'name': 'Spor Salonu', 'capacity': 2}],
        'subjects': [{'id': s[0], 'name': s[1], 'hard': s[3]} for s in SUBJECTS],
        'assignments': assignments,
        'constraints': [
            {'id': 1, 'type': 'teacher_unavailable', 'hard': True, 'params': {'teacher_id': 1, 'slots': [{'day': 5}]}},
            {'id': 2, 'type': 'teacher_min_days_off', 'hard': False, 'weight': 20, 'params': {'teacher_id': None, 'count': 1}},
            {'id': 3, 'type': 'subject_period_preference', 'hard': False, 'weight': 5,
             'params': {'subject_id': 11, 'mode': 'avoid', 'periods': [1]}},
            {'id': 4, 'type': 'teacher_max_consecutive', 'hard': True, 'params': {'teacher_id': None, 'max': 4}},
        ],
        'locked': [],
    }
