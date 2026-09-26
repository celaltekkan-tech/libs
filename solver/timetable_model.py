"""OR-Tools CP-SAT ile haftalık ders programı modeli.

Girdi (Node tarafının timetableBuildService.js ile ürettiği JSON):
  days: [1..6]            Kullanılan günler (1=Pazartesi)
  periods: int            Günlük ders saati sayısı
  lunch_after: int|None   Bu saatten sonra öğle arası (blok ders bölünmez)
  time_limit: int         Saniye
  workers: int            CP-SAT arama işçisi
  weights: {...}          Esnek kural ağırlıkları
  max_subject_daily: int  Bir şubede bir dersin günlük üst sınırı
  classrooms/teachers/rooms/subjects: [{id, label|name, ...}]
  assignments: [{id, classroom_id, subject_id, teacher_id, hours, blocks, room_id, sync_group}]
  constraints: [{id, type, hard, weight, params}]
  locked: [{assignment_id, day, period}]

Çıktı: status, lessons, score, violations, diagnostics.
"""

import time
from collections import defaultdict

from ortools.sat.python import cp_model

DAY_NAMES = {1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba', 4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi', 7: 'Pazar'}

DEFAULT_WEIGHTS = {
    'teacher_gaps': 10,
    'class_compact': 60,
    'teacher_single_hour_day': 6,
    'hard_subject_late': 3,
    'soft_constraint': 20,
}

STATUS_NAMES = {
    cp_model.OPTIMAL: 'OPTIMAL',
    cp_model.FEASIBLE: 'FEASIBLE',
    cp_model.INFEASIBLE: 'INFEASIBLE',
    cp_model.MODEL_INVALID: 'MODEL_INVALID',
    cp_model.UNKNOWN: 'UNKNOWN',
}


class Ctx:
    """Girdi verisini indeksleyip ön hesaplamaları tutar."""

    def __init__(self, data):
        self.data = data
        self.days = list(data.get('days') or [1, 2, 3, 4, 5])
        self.P = int(data.get('periods') or 8)
        self.periods = list(range(1, self.P + 1))
        la = data.get('lunch_after')
        self.lunch = int(la) if la and 0 < int(la) < self.P else None
        self.weights = {**DEFAULT_WEIGHTS, **(data.get('weights') or {})}
        self.max_subject_daily = int(data.get('max_subject_daily') or 2)

        self.classrooms = {c['id']: c for c in data.get('classrooms', [])}
        self.teachers = {t['id']: t for t in data.get('teachers', [])}
        self.rooms = {r['id']: r for r in data.get('rooms', [])}
        self.subjects = {s['id']: s for s in data.get('subjects', [])}

        self.assignments = [a for a in data.get('assignments', []) if int(a.get('hours') or 0) > 0]
        self.by_id = {a['id']: a for a in self.assignments}

        # Senkron gruplar: aynı sync_group'taki atamalar aynı saatlere yerleşir.
        # Grubun ilk ataması "kanonik"tir; diğerleri onun değişkenlerini kullanır.
        self.canon = {}
        groups = defaultdict(list)
        for a in self.assignments:
            g = (a.get('sync_group') or '').strip()
            if g:
                groups[g].append(a)
            else:
                self.canon[a['id']] = a['id']
        self.groups = dict(groups)
        for members in groups.values():
            leader = members[0]['id']
            for m in members:
                self.canon[m['id']] = leader

    def label_classroom(self, cid):
        c = self.classrooms.get(cid)
        return c.get('label') if c else f'Şube #{cid}'

    def label_teacher(self, tid):
        t = self.teachers.get(tid)
        return t.get('name') if t else f'Öğretmen #{tid}'

    def label_subject(self, sid):
        s = self.subjects.get(sid)
        return s.get('name') if s else f'Ders #{sid}'

    def label_room(self, rid):
        r = self.rooms.get(rid)
        return r.get('name') if r else f'Mekan #{rid}'

    def label_assignment(self, a):
        return f"{self.label_classroom(a['classroom_id'])} {self.label_subject(a['subject_id'])}"

    def blocks_of(self, a):
        blocks = [int(b) for b in (a.get('blocks') or []) if int(b) > 0]
        return blocks or default_blocks(int(a['hours']))

    def segments(self):
        """Öğle arası ile bölünen ardışık saat aralıkları."""
        if self.lunch:
            return [(1, self.lunch), (self.lunch + 1, self.P)]
        return [(1, self.P)]

    def max_block_len(self):
        return max(e - s + 1 for s, e in self.segments())

    def valid_starts(self, length):
        starts = []
        for s, e in self.segments():
            for p in range(s, e - length + 2):
                starts.append(p)
        return starts

    def cells_from_slots(self, slots):
        """[{day, periods:[..]}] -> {(d,p)}; boş periods tüm gün demektir."""
        cells = set()
        for slot in slots or []:
            d = int(slot.get('day') or 0)
            if d not in self.days:
                continue
            ps = [int(p) for p in (slot.get('periods') or []) if 1 <= int(p) <= self.P]
            for p in ps or self.periods:
                cells.add((d, p))
        return cells


def default_blocks(hours):
    """Varsayılan blok düzeni: 2'li bloklar, artan 1 saat (5 -> 2+2+1)."""
    if hours <= 0:
        return []
    blocks = [2] * (hours // 2)
    if hours % 2:
        blocks.append(1)
    return blocks


def constraint_label(ctx, c):
    t = c.get('type')
    p = c.get('params') or {}
    who_t = ctx.label_teacher(p['teacher_id']) if p.get('teacher_id') else 'Tüm öğretmenler'
    if t == 'teacher_unavailable':
        return f'{who_t}: müsait olmadığı saatler'
    if t == 'classroom_unavailable':
        return f"{ctx.label_classroom(p.get('classroom_id'))}: kapalı saatler"
    if t == 'room_unavailable':
        return f"{ctx.label_room(p.get('room_id'))}: kapalı saatler"
    if t == 'teacher_max_daily_hours':
        return f"{who_t}: günde en fazla {p.get('max')} saat"
    if t == 'teacher_min_days_off':
        return f"{who_t}: en az {p.get('count')} boş gün"
    if t == 'teacher_max_consecutive':
        return f"{who_t}: en fazla {p.get('max')} saat üst üste"
    if t == 'subject_period_preference':
        mode = 'yalnızca' if p.get('mode') == 'only' else 'hariç'
        return f"{ctx.label_subject(p.get('subject_id'))}: belirli saatler {mode}"
    if t == 'subject_max_daily':
        return f"{ctx.label_subject(p.get('subject_id'))}: günde en fazla {p.get('max')} saat"
    return t or 'Kısıt'


# ---------------------------------------------------------------------------
# Ön kontrol: çözücüye girmeden bariz imkansızlıkları Türkçe raporlar.
# ---------------------------------------------------------------------------

def check(data):
    ctx = Ctx(data)
    issues = []

    def add(level, message, **extra):
        issues.append({'level': level, 'message': message, **extra})

    n_days = len(ctx.days)
    total_slots = n_days * ctx.P
    max_len = ctx.max_block_len()

    if not ctx.assignments:
        add('error', 'Hiç ders ataması yok. Önce "Ders Atamaları" sekmesinden atama oluşturun.')

    for a in ctx.assignments:
        blocks = ctx.blocks_of(a)
        if sum(blocks) != int(a['hours']):
            add('error', f"{ctx.label_assignment(a)}: blok düzeni ({'+'.join(map(str, blocks))}) haftalık saate ({a['hours']}) eşit değil.",
                assignment_ids=[a['id']])
        if max(blocks) > max_len:
            add('error', f"{ctx.label_assignment(a)}: {max(blocks)} saatlik blok, öğle arasıyla bölünmeyen en uzun aralığa ({max_len} saat) sığmıyor.",
                assignment_ids=[a['id']])
        if len(blocks) > n_days:
            add('warning', f"{ctx.label_assignment(a)}: {len(blocks)} blok var ama {n_days} gün var; bazı bloklar aynı güne düşecek.",
                assignment_ids=[a['id']])
        if not a.get('teacher_id'):
            add('warning', f"{ctx.label_assignment(a)}: öğretmen atanmamış; öğretmen çakışması kontrol edilmeyecek.",
                assignment_ids=[a['id']])

    for g, members in ctx.groups.items():
        hours = {int(m['hours']) for m in members}
        patterns = {tuple(ctx.blocks_of(m)) for m in members}
        if len(hours) > 1 or len(patterns) > 1:
            add('error', f'"{g}" senkron grubundaki derslerin haftalık saatleri ve blok düzenleri aynı olmalı.',
                assignment_ids=[m['id'] for m in members])

    # Hard kapalı hücreler (kapasite hesaplarında düşülür).
    teacher_closed = defaultdict(set)
    class_closed = defaultdict(set)
    room_closed = defaultdict(set)
    for c in data.get('constraints', []):
        if not c.get('hard'):
            continue
        p = c.get('params') or {}
        cells = ctx.cells_from_slots(p.get('slots'))
        if c.get('type') == 'teacher_unavailable':
            if p.get('teacher_id'):
                teacher_closed[p['teacher_id']] |= cells
            else:
                for tid in ctx.teachers:
                    teacher_closed[tid] |= cells
        elif c.get('type') == 'classroom_unavailable' and p.get('classroom_id'):
            class_closed[p['classroom_id']] |= cells
        elif c.get('type') == 'room_unavailable' and p.get('room_id'):
            room_closed[p['room_id']] |= cells

    class_hours = defaultdict(int)
    class_seen = defaultdict(set)
    teacher_hours = defaultdict(int)
    teacher_seen = defaultdict(set)
    room_hours = defaultdict(int)
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        h = int(a['hours'])
        if cn not in class_seen[a['classroom_id']]:
            class_seen[a['classroom_id']].add(cn)
            class_hours[a['classroom_id']] += h
        if a.get('teacher_id') and cn not in teacher_seen[a['teacher_id']]:
            teacher_seen[a['teacher_id']].add(cn)
            teacher_hours[a['teacher_id']] += h
        if a.get('room_id'):
            room_hours[a['room_id']] += h

    for cid, h in class_hours.items():
        avail = total_slots - len(class_closed[cid])
        if h > avail:
            add('error', f'{ctx.label_classroom(cid)}: haftalık {h} saat ders atanmış ama yalnızca {avail} boş saat var.',
                classroom_id=cid)
    for tid, h in teacher_hours.items():
        avail = total_slots - len(teacher_closed[tid])
        if h > avail:
            add('error', f'{ctx.label_teacher(tid)}: haftalık {h} saat dersi var ama müsait olduğu saat sayısı {avail}.',
                teacher_id=tid)
        elif h > avail * 0.9:
            add('warning', f'{ctx.label_teacher(tid)}: {h} saat ders / {avail} müsait saat; çok sıkışık, çözüm zorlaşabilir.',
                teacher_id=tid)
    for rid, h in room_hours.items():
        cap = int((ctx.rooms.get(rid) or {}).get('capacity') or 1)
        avail = (total_slots - len(room_closed[rid])) * cap
        if h > avail:
            add('error', f'{ctx.label_room(rid)}: haftalık {h} saat kullanım isteniyor ama kapasite {avail} saat.',
                room_id=rid)

    for lk in data.get('locked', []):
        if lk.get('assignment_id') not in ctx.by_id:
            add('warning', 'Kilitli bir ders artık atamalarda yok; yok sayılacak.')

    return {
        'ok': not any(i['level'] == 'error' for i in issues),
        'issues': issues,
        'stats': {
            'assignments': len(ctx.assignments),
            'classrooms': len(class_hours),
            'teachers': len(teacher_hours),
            'total_hours': sum(int(a['hours']) for a in ctx.assignments),
            'slots_per_week': total_slots,
        },
    }


# ---------------------------------------------------------------------------
# Model kurulumu
# ---------------------------------------------------------------------------

class Built:
    pass


def build(ctx, with_assumptions=False):
    m = cp_model.CpModel()
    b = Built()
    b.model = m
    b.lits = []           # (lit, label, constraint_id)
    b.terms = defaultdict(list)   # skor bileşeni -> [(weight, expr)]
    b.violations = defaultdict(list)  # constraint_id -> [expr]

    def enforce_lit(label, cid=None):
        lit = m.NewBoolVar(f'lit_{len(b.lits)}')
        b.lits.append((lit, label, cid))
        if not with_assumptions:
            m.Add(lit == 1)
        return lit

    days, periods = ctx.days, ctx.periods
    day_index = {d: i for i, d in enumerate(days)}

    # --- Blok değişkenleri (yalnızca kanonik atamalar) ---
    x = {}           # (block_key, d, p) -> var
    blocks = defaultdict(list)   # canon aid -> [(block_key, length)]
    occ = defaultdict(list)      # (canon aid, d, p) -> [var]
    starts_by_day = defaultdict(list)  # (canon aid, d) -> [var]

    canon_ids = sorted({ctx.canon[a['id']] for a in ctx.assignments})
    for aid in canon_ids:
        a = ctx.by_id[aid]
        for bi, length in enumerate(ctx.blocks_of(a)):
            key = (aid, bi)
            blocks[aid].append((key, length))
            vs = []
            for d in days:
                for p in ctx.valid_starts(length):
                    v = m.NewBoolVar(f'x_{aid}_{bi}_{d}_{p}')
                    x[(key, d, p)] = v
                    vs.append(v)
                    starts_by_day[(aid, d)].append(v)
                    for k in range(length):
                        occ[(aid, d, p + k)].append(v)
            m.AddExactlyOne(vs)

    def occ_expr(aid, d, p):
        return sum(occ.get((ctx.canon[aid], d, p), []))

    # --- Aynı atamanın blokları farklı günlere (mümkünse) ---
    spread_lit = enforce_lit('Aynı dersin blokları farklı günlere dağılsın')
    for aid in canon_ids:
        bl = blocks[aid]
        if len(bl) <= len(days):
            for d in days:
                m.Add(sum(starts_by_day[(aid, d)]) <= 1).OnlyEnforceIf(spread_lit)
            # Simetri kırma: aynı uzunluktaki bloklar gün sırasına göre.
            for (k1, l1), (k2, l2) in zip(bl, bl[1:]):
                if l1 == l2:
                    e1 = sum(day_index[d] * x[(k1, d, p)] for d in days for p in ctx.valid_starts(l1))
                    e2 = sum(day_index[d] * x[(k2, d, p)] for d in days for p in ctx.valid_starts(l2))
                    m.Add(e1 < e2).OnlyEnforceIf(spread_lit)

    # --- Şube / öğretmen meşguliyeti (senkron gruplar tekilleştirilir) ---
    class_canon = defaultdict(set)
    teacher_canon = defaultdict(set)
    room_members = defaultdict(list)
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        class_canon[a['classroom_id']].add(cn)
        if a.get('teacher_id'):
            teacher_canon[a['teacher_id']].add(cn)
        if a.get('room_id'):
            room_members[a['room_id']].append(cn)

    c_busy = {}
    for cid, cset in class_canon.items():
        for d in days:
            for p in periods:
                v = m.NewBoolVar(f'cb_{cid}_{d}_{p}')
                m.Add(v == sum(sum(occ.get((cn, d, p), [])) for cn in cset))
                c_busy[(cid, d, p)] = v
    b.c_busy = c_busy

    t_busy = {}
    for tid, tset in teacher_canon.items():
        for d in days:
            for p in periods:
                v = m.NewBoolVar(f'tb_{tid}_{d}_{p}')
                m.Add(v == sum(sum(occ.get((cn, d, p), [])) for cn in tset))
                t_busy[(tid, d, p)] = v
    b.t_busy = t_busy

    r_use = {}
    for rid, members in room_members.items():
        cap = int((ctx.rooms.get(rid) or {}).get('capacity') or 1)
        for d in days:
            for p in periods:
                e = sum(sum(occ.get((cn, d, p), [])) for cn in members)
                m.Add(e <= cap)
                r_use[(rid, d, p)] = e

    # --- Bir dersin şubedeki günlük üst sınırı ---
    subj_daily_lit = enforce_lit(f'Bir ders bir şubede günde en fazla {ctx.max_subject_daily} saat')
    cs_canon = defaultdict(set)
    for a in ctx.assignments:
        cs_canon[(a['classroom_id'], a['subject_id'])].add(ctx.canon[a['id']])
    for (cid, sid), cset in cs_canon.items():
        longest = max(l for cn in cset for _, l in blocks[cn])
        limit = max(ctx.max_subject_daily, longest)
        for d in days:
            m.Add(sum(sum(occ.get((cn, d, p), [])) for cn in cset for p in periods) <= limit).OnlyEnforceIf(subj_daily_lit)

    # --- Kilitli dersler ---
    locked_lit = None
    for lk in ctx.data.get('locked', []):
        aid = lk.get('assignment_id')
        d, p = int(lk.get('day') or 0), int(lk.get('period') or 0)
        if aid not in ctx.by_id or d not in days or p not in periods:
            continue
        if locked_lit is None:
            locked_lit = enforce_lit('Kilitlenen dersler')
        m.Add(occ_expr(aid, d, p) >= 1).OnlyEnforceIf(locked_lit)

    # --- Kullanıcı kısıtları ---
    soft_w = int(ctx.weights['soft_constraint'])

    def targets_teachers(p):
        tid = p.get('teacher_id')
        if tid:
            return [tid] if tid in teacher_canon else []
        return list(teacher_canon.keys())

    for c in ctx.data.get('constraints', []):
        ctype = c.get('type')
        p = c.get('params') or {}
        hard = bool(c.get('hard'))
        w = int(c.get('weight') or soft_w)
        cid = c.get('id')
        label = constraint_label(ctx, c)
        lit = enforce_lit(label, cid) if hard else None

        def zero(expr):
            if isinstance(expr, int):
                return
            if hard:
                m.Add(expr == 0).OnlyEnforceIf(lit)
            else:
                b.violations[cid].append(expr)
                b.terms['soft_constraints'].append((w, expr))

        def at_most(expr, limit, name):
            if isinstance(expr, int):
                return
            if hard:
                m.Add(expr <= limit).OnlyEnforceIf(lit)
            else:
                ex = m.NewIntVar(0, 100, name)
                m.Add(ex >= expr - limit)
                b.violations[cid].append(ex)
                b.terms['soft_constraints'].append((w, ex))

        if ctype == 'teacher_unavailable':
            cells = ctx.cells_from_slots(p.get('slots'))
            for tid in targets_teachers(p):
                zero(sum(t_busy[(tid, d, pp)] for d, pp in cells))

        elif ctype == 'classroom_unavailable':
            cls = p.get('classroom_id')
            if cls in class_canon:
                cells = ctx.cells_from_slots(p.get('slots'))
                zero(sum(c_busy[(cls, d, pp)] for d, pp in cells))

        elif ctype == 'room_unavailable':
            rid = p.get('room_id')
            if rid in room_members:
                cells = ctx.cells_from_slots(p.get('slots'))
                zero(sum(r_use[(rid, d, pp)] for d, pp in cells))

        elif ctype == 'teacher_max_daily_hours':
            mx = int(p.get('max') or ctx.P)
            for tid in targets_teachers(p):
                for d in days:
                    at_most(sum(t_busy[(tid, d, pp)] for pp in periods), mx, f'mdh_{cid}_{tid}_{d}')

        elif ctype == 'teacher_min_days_off':
            cnt = int(p.get('count') or 1)
            for tid in targets_teachers(p):
                used = []
                for d in days:
                    u = m.NewBoolVar(f'du_{cid}_{tid}_{d}')
                    for pp in periods:
                        m.Add(u >= t_busy[(tid, d, pp)])
                    used.append(u)
                at_most(sum(used), len(days) - cnt, f'mdo_{cid}_{tid}')

        elif ctype == 'teacher_max_consecutive':
            mx = int(p.get('max') or ctx.P)
            for tid in targets_teachers(p):
                for d in days:
                    for s in range(1, ctx.P - mx + 1):
                        window = [t_busy[(tid, d, pp)] for pp in range(s, s + mx + 1)]
                        at_most(sum(window), mx, f'mc_{cid}_{tid}_{d}_{s}')

        elif ctype == 'subject_period_preference':
            sid = p.get('subject_id')
            cls = p.get('classroom_id')
            mode = p.get('mode') or 'avoid'
            pdays = [int(d) for d in (p.get('days') or []) if int(d) in days] or days
            pps = {int(x_) for x_ in (p.get('periods') or []) if 1 <= int(x_) <= ctx.P}
            targets = {cn for (c_, s_), cset in cs_canon.items() if s_ == sid and (not cls or c_ == cls) for cn in cset}
            if targets and pps:
                if mode == 'only':
                    cells = [(d, pp) for d in days for pp in periods if not (d in pdays and pp in pps)]
                else:
                    cells = [(d, pp) for d in pdays for pp in pps]
                zero(sum(sum(occ.get((cn, d, pp), [])) for cn in targets for d, pp in cells))

        elif ctype == 'subject_max_daily':
            sid = p.get('subject_id')
            cls = p.get('classroom_id')
            mx = int(p.get('max') or ctx.P)
            for (c_, s_), cset in cs_canon.items():
                if s_ != sid or (cls and c_ != cls):
                    continue
                for d in days:
                    at_most(sum(sum(occ.get((cn, d, pp), [])) for cn in cset for pp in periods), mx, f'smd_{cid}_{c_}_{d}')

    # --- Esnek genel kurallar ---
    def prefix_or(seq, name):
        """seq[i] için: önceki elemanlardan herhangi biri 1 mi."""
        out = []
        prev = None
        for i, v in enumerate(seq):
            if i == 0:
                out.append(None)
                prev = v
                continue
            o = m.NewBoolVar(f'{name}_{i}')
            if out[-1] is None:
                m.Add(o == prev)
            else:
                m.AddMaxEquality(o, [out[-1], prev])
            out.append(o)
            prev = v
        return out

    wg = int(ctx.weights['teacher_gaps'])
    ws = int(ctx.weights['teacher_single_hour_day'])
    if wg or ws:
        for tid in teacher_canon:
            for d in days:
                seq = [t_busy[(tid, d, pp)] for pp in periods]
                if wg:
                    for s, e in ctx.segments():
                        sub = seq[s - 1:e]
                        before = prefix_or(sub, f'tgb_{tid}_{d}_{s}')
                        after = list(reversed(prefix_or(list(reversed(sub)), f'tga_{tid}_{d}_{s}')))
                        for i, v in enumerate(sub):
                            if before[i] is None or after[i] is None:
                                continue
                            g = m.NewBoolVar(f'tg_{tid}_{d}_{s}_{i}')
                            m.Add(g >= before[i] + after[i] - v - 1)
                            b.terms['teacher_gaps'].append((wg, g))
                if ws:
                    tot = sum(seq)
                    used = m.NewBoolVar(f'tu_{tid}_{d}')
                    for v in seq:
                        m.Add(used >= v)
                    single = m.NewBoolVar(f'ts_{tid}_{d}')
                    m.Add(single >= 2 * used - tot)
                    b.terms['teacher_single_hour_day'].append((ws, single))

    wc = int(ctx.weights['class_compact'])
    if wc:
        # Şube günü 1. saatten başlayıp boşluksuz ilerlesin: arkasında ders
        # olan her boş hücre cezalandırılır (geç başlama + ara boşluk).
        for cid in class_canon:
            for d in days:
                seq = [c_busy[(cid, d, pp)] for pp in periods]
                after = list(reversed(prefix_or(list(reversed(seq)), f'ca_{cid}_{d}')))
                for i, v in enumerate(seq):
                    if after[i] is None:
                        continue
                    e = m.NewBoolVar(f'ce_{cid}_{d}_{i}')
                    m.Add(e >= after[i] - v)
                    b.terms['class_compact'].append((wc, e))

    wh = int(ctx.weights['hard_subject_late'])
    if wh:
        late = [pp for pp in periods if pp >= ctx.P - 1]
        for a in ctx.assignments:
            if ctx.canon[a['id']] != a['id']:
                continue
            if not (ctx.subjects.get(a['subject_id']) or {}).get('hard'):
                continue
            for d in days:
                for pp in late:
                    e = occ_expr(a['id'], d, pp)
                    if not isinstance(e, int):
                        b.terms['hard_subject_late'].append((wh, e))

    obj = [w * e for comp in b.terms.values() for w, e in comp]
    if obj:
        m.Minimize(sum(obj))

    b.x = x
    b.blocks = blocks
    if with_assumptions:
        m.AddAssumptions([lit for lit, _, _ in b.lits])
    return b


class _Callback(cp_model.CpSolverSolutionCallback):
    def __init__(self, on_progress, should_stop):
        super().__init__()
        self.on_progress = on_progress
        self.should_stop = should_stop
        self.count = 0
        self.t0 = time.time()

    def on_solution_callback(self):
        self.count += 1
        if self.on_progress:
            self.on_progress({
                'solutions': self.count,
                'objective': self.ObjectiveValue(),
                'best_bound': self.BestObjectiveBound(),
                'elapsed': round(time.time() - self.t0, 1),
            })
        if self.should_stop and self.should_stop():
            self.StopSearch()


def _diagnose(ctx, time_limit=20):
    """Çözümsüzlükte hangi kesin kuralların çeliştiğini bulur (tek işçi + assumptions)."""
    b = build(ctx, with_assumptions=True)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 1
    st = solver.Solve(b.model)
    if st != cp_model.INFEASIBLE:
        return []
    core = set(solver.SufficientAssumptionsForInfeasibility())
    out = []
    for lit, label, cid in b.lits:
        if lit.Index() in core:
            out.append({'label': label, 'constraint_id': cid})
    return out


def solve(data, on_progress=None, should_stop=None):
    pre = check(data)
    if not pre['ok']:
        return {'status': 'INVALID', 'lessons': [], 'score': {}, 'violations': [], 'diagnostics': pre['issues']}

    ctx = Ctx(data)
    t0 = time.time()
    b = build(ctx)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(data.get('time_limit') or 60)
    solver.parameters.num_workers = int(data.get('workers') or 4)
    if data.get('seed') is not None:
        solver.parameters.random_seed = int(data['seed'])
    cb = _Callback(on_progress, should_stop)
    st = solver.Solve(b.model, cb)
    status = STATUS_NAMES.get(st, str(st))

    diagnostics = [i for i in pre['issues'] if i['level'] == 'warning']

    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        if st == cp_model.INFEASIBLE:
            core = _diagnose(ctx)
            if core:
                diagnostics.insert(0, {
                    'level': 'error',
                    'message': 'Bu kesin kurallar birlikte sağlanamıyor: ' + '; '.join(c['label'] for c in core)
                               + '. Birini esnek yapın veya kaldırın.',
                    'constraint_ids': [c['constraint_id'] for c in core if c['constraint_id']],
                })
            else:
                diagnostics.insert(0, {
                    'level': 'error',
                    'message': 'Öğretmen/şube/mekan çakışmaları nedeniyle çözüm yok. Öğretmen yüklerini ve mekan kapasitelerini kontrol edin.',
                })
        elif should_stop and should_stop():
            status = 'CANCELLED'
        else:
            diagnostics.insert(0, {
                'level': 'error',
                'message': 'Süre içinde geçerli bir program bulunamadı. Süreyi artırın veya kısıtları gevşetin.',
            })
        return {'status': status, 'lessons': [], 'score': {}, 'violations': [], 'diagnostics': diagnostics,
                'wall_time': round(time.time() - t0, 1)}

    lessons = []
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        for key, length in b.blocks[cn]:
            for d in ctx.days:
                for p in ctx.valid_starts(length):
                    if solver.Value(b.x[(key, d, p)]):
                        for k in range(length):
                            lessons.append({'assignment_id': a['id'], 'day': d, 'period': p + k,
                                            'room_id': a.get('room_id')})

    def val(e):
        return int(solver.Value(e)) if not isinstance(e, int) else e

    score = {comp: sum(val(e) for _, e in items) for comp, items in b.terms.items()}
    violations = [{'constraint_id': cid, 'count': sum(val(e) for e in exprs)}
                  for cid, exprs in b.violations.items()]
    violations = [v for v in violations if v['count'] > 0]

    return {
        'status': status,
        'objective': solver.ObjectiveValue() if b.terms else 0,
        'best_bound': solver.BestObjectiveBound() if b.terms else 0,
        'wall_time': round(time.time() - t0, 1),
        'solutions': cb.count,
        'lessons': lessons,
        'score': score,
        'violations': violations,
        'diagnostics': diagnostics,
    }
