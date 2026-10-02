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
  assignments: [{id, classroom_id, subject_id, teacher_id, teacher_ids, hours, blocks,
                 allow_split, allow_merge, room_id, sync_group}]
  constraints: [{id, type, hard, weight, params}]
  locked: [{assignment_id, day, period}]
  availability: [{type: school|teacher|classroom|room|subject, id, closed: [[d,p]], avoid: [[d,p]]}]
  block_across_lunch: bool  Bloklar öğle arasını aşabilir (subject_no_lunch_split ile sınırlanır)
  class_lunch: {classroom_id: after}  Şubeye özel öğle arası

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
    'availability_avoid': 15,
    'block_flex': 8,
    'teacher_day_off': 12,
}

# Bilsa dağıtım penceresindeki çalışma ayarları. 0 = sınır yok.
# methods=all: ilk arama program bulamazsa (süre biterse) diğer arama yöntemleri denenir.
DEFAULT_DISTRIBUTION = {
    'place_seconds': 90,
    'gap_seconds': 90,
    'split_double': True,
    'merge_singles': True,
    'merge_two_one': True,
    'eliminate_gaps': True,
    'free_day': False,
    'same_class_subjects': 'off',  # off | soft | hard
    'prioritize_difficulty': False,
    'max_daily_hours': 0,
    'max_windows': 25,
    'workers': 4,
    'methods': 'all',
}

# timetableRunService bütçe hesabı bu listeyle aynı uzunlukta olmalı.
SEARCH_STRATEGIES = (
    ('varsayilan', 'Varsayılan arama', {}),
    ('hizli', 'Hızlı yeniden başlatma', {
        'search_branching_name': 'PORTFOLIO_WITH_QUICK_RESTART_SEARCH',
        'random_seed': 1,
        'randomize_search': True,
    }),
    ('dogrusal', 'Doğrusal gevşetme', {
        'search_branching_name': 'LP_SEARCH',
        'random_seed': 2,
        'linearization_level': 2,
    }),
    ('maliyet', 'Maliyet tabanlı arama', {
        'search_branching_name': 'PSEUDO_COST_SEARCH',
        'random_seed': 3,
        'randomize_search': True,
    }),
)

AVAIL_TYPES = ('school', 'teacher', 'classroom', 'room', 'subject')

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
        raw_dist = data.get('distribution')
        self.use_distribution = isinstance(raw_dist, dict)
        self.distribution = {**DEFAULT_DISTRIBUTION, **(raw_dist or {})}
        self.teacher_overrides = data.get('teacher_overrides') or {}
        if self.use_distribution:
            if not self.distribution.get('eliminate_gaps'):
                self.weights['teacher_gaps'] = 0
            if not self.distribution.get('prioritize_difficulty'):
                self.weights['hard_subject_late'] = 0
        culture = data.get('max_culture_daily')
        if culture in (None, ''):
            culture = data.get('max_subject_daily') or 2
        self.max_culture_daily = int(culture)
        self.max_subject_daily = self.max_culture_daily
        vocational = data.get('max_vocational_daily')
        self.max_vocational_daily = int(vocational if vocational not in (None, '') else self.P)
        self.block_across_lunch = bool(data.get('block_across_lunch'))
        self.class_lunch = {}
        for k, v in (data.get('class_lunch') or {}).items():
            try:
                k, v = int(k), int(v)
            except (TypeError, ValueError):
                continue
            if 0 < v < self.P:
                self.class_lunch[k] = v

        self.classrooms = {c['id']: c for c in data.get('classrooms', [])}
        self.teachers = {t['id']: t for t in data.get('teachers', [])}
        self.rooms = {r['id']: r for r in data.get('rooms', [])}
        self.subjects = {s['id']: s for s in data.get('subjects', [])}

        self.assignments = [a for a in data.get('assignments', []) if int(a.get('hours') or 0) > 0]
        self.by_id = {a['id']: a for a in self.assignments}
        self._structure = {}

        # Zaman tablosu: (tür, id) -> {'closed': {(d,p)}, 'avoid': {(d,p)}}; okul için id 0.
        self.avail = {}
        for row in data.get('availability') or []:
            t = row.get('type')
            if t not in AVAIL_TYPES:
                continue
            key = (t, 0 if t == 'school' else row.get('id'))
            cur = self.avail.setdefault(key, {'closed': set(), 'avoid': set()})
            for state in ('closed', 'avoid'):
                for cell in row.get(state) or []:
                    try:
                        d, p = int(cell[0]), int(cell[1])
                    except (TypeError, ValueError, IndexError):
                        continue
                    if d in self.days and 1 <= p <= self.P:
                        cur[state].add((d, p))
            cur['avoid'] -= cur['closed']

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

    def label_entity(self, t, eid):
        if t == 'school':
            return 'Okul'
        if t == 'teacher':
            return self.label_teacher(eid)
        if t == 'classroom':
            return self.label_classroom(eid)
        if t == 'room':
            return self.label_room(eid)
        return self.label_subject(eid)

    def teachers_of(self, a):
        """1. öğretmen + ortak öğretmenler (tekrarsız)."""
        out = []
        for tid in [a.get('teacher_id')] + list(a.get('teacher_ids') or []):
            if tid and tid not in out:
                out.append(tid)
        return out

    def class_structure(self, cid):
        """Şubenin çakışma yapısı: (çekirdek, seçmeli grupları, öğrenci profilleri | None).

        Çekirdek: tüm öğrencilerin girdiği dersler. Aynı seçmeli grubundaki dersler
        alternatiftir (öğrenci birini alır) ve paralel işlenebilir. Öğrenci seçimleri
        varsa profiller (her öğrencinin aldığı seçmeliler) esas alınır.
        """
        if cid in self._structure:
            return self._structure[cid]
        core, groups, electives = set(), defaultdict(set), set()
        for a in self.assignments:
            if a['classroom_id'] != cid:
                continue
            cn = self.canon[a['id']]
            g = (a.get('elective_group') or '').strip()
            if g:
                groups[g].add(cn)
                electives.add(cn)
            else:
                core.add(cn)
        core -= electives  # senkron grupta hem seçmeli hem çekirdek varsa seçmeli sayılır
        profiles = None
        raw = (self.data.get('elective_profiles') or {}).get(str(cid)) or \
            (self.data.get('elective_profiles') or {}).get(cid)
        if raw and electives:
            seen = set()
            profiles = []
            covered = set()
            for prof in raw:
                ps = frozenset(self.canon[i] for i in prof if i in self.canon and self.canon[i] in electives)
                if ps and ps not in seen:
                    seen.add(ps)
                    profiles.append(ps)
                    covered |= ps
            # Kimsenin seçmediği seçmeliler yalnız çekirdekle çakışmasın.
            for cn in electives - covered:
                profiles.append(frozenset([cn]))
        self._structure[cid] = (core, dict(groups), profiles)
        return self._structure[cid]

    def class_required_hours(self, cid):
        """Şubenin haftada dolu olacağı en az saat (paralel seçmeliler bir kez sayılır)."""
        core, groups, profiles = self.class_structure(cid)
        h = lambda cn: int(self.by_id[cn]['hours'])  # noqa: E731
        total = sum(h(cn) for cn in core)
        if profiles is not None:
            total += max((sum(h(cn) for cn in p) for p in profiles), default=0)
        else:
            total += sum(max(h(cn) for cn in cs) for cs in groups.values())
        return total

    def closed(self, t, eid):
        return (self.avail.get((t, eid)) or {}).get('closed', set())

    def _override(self, tid):
        ov = self.teacher_overrides.get(str(tid))
        if ov is None:
            ov = self.teacher_overrides.get(tid)
        return ov or {}

    def _teacher_number(self, tid, key, global_key):
        """Öğretmene özel sayı. Yoksa genel ayar. 0 = sınır yok."""
        if not self.use_distribution:
            return 0
        ov = self._override(tid)
        if key in ov and ov[key] is not None and ov[key] != '':
            try:
                return int(ov[key])
            except (TypeError, ValueError):
                return 0
        try:
            return int(self.distribution.get(global_key) or 0)
        except (TypeError, ValueError):
            return 0

    def teacher_daily_cap(self, tid):
        return self._teacher_number(tid, 'max_daily_hours', 'max_daily_hours')

    def teacher_window_cap(self, tid):
        return self._teacher_number(tid, 'max_windows', 'max_windows')

    def teacher_wants_day_off(self, tid):
        if not self.use_distribution:
            return False
        ov = self._override(tid)
        if ov.get('free_day') is True or ov.get('free_day') is False:
            return bool(ov['free_day'])
        return bool(self.distribution.get('free_day'))

    def teacher_same_class_mode(self, tid):
        """off | soft | hard. Öğretmende 'on' genel kipi kullanır; genel kapalıysa yumuşak."""
        if not self.use_distribution:
            return 'off'
        ov = self._override(tid)
        choice = ov.get('same_class_subjects')
        global_mode = self.distribution.get('same_class_subjects') or 'off'
        if global_mode not in ('off', 'soft', 'hard'):
            global_mode = 'off'
        if choice in ('off', 'on'):
            if choice == 'off':
                return 'off'
            return global_mode if global_mode in ('soft', 'hard') else 'soft'
        return global_mode

    def blocks_of(self, a):
        blocks = [int(b) for b in (a.get('blocks') or []) if int(b) > 0]
        if blocks:
            return blocks
        if a.get('vocational'):
            return vocational_blocks(int(a['hours']), self.max_vocational_daily)
        return default_blocks(int(a['hours']))

    def block_variants(self, a):
        """[(değişiklik sayısı, bloklar)].

        Bölme: ikili blok 1+1 olabilir. Birleştirme: iki tekli 2'lik blok olabilir.
        2+1 birleştirme: bir ikili ile bir tekli 3 saatlik tek blok olabilir.
        Gün sayısından fazla bloğa bölünen düzen de tutulur; o düzen aynı güne birden
        fazla blok koyabilir. Diğer düzenlerde bloklar farklı günlere dağılır.
        """
        base = self.blocks_of(a)
        out = [(0, base)]
        seen = {tuple(sorted(base))}
        twos = base.count(2)
        ones = base.count(1)
        rest = [b for b in base if b not in (1, 2)]
        span = bool(a.get('vocational'))
        longest = self.max_block_len(a.get('classroom_id'), span_lunch=span)

        def add(changes, blocks):
            key = tuple(sorted(blocks))
            if key in seen or not blocks:
                return
            if max(blocks) > longest:
                return
            seen.add(key)
            out.append((changes, blocks))

        if a.get('allow_split'):
            for j in range(1, twos + 1):
                add(j, sorted(rest + [2] * (twos - j) + [1] * (ones + 2 * j), reverse=True))
        if a.get('allow_merge'):
            for j in range(1, ones // 2 + 1):
                add(j, sorted(rest + [2] * (twos + j) + [1] * (ones - 2 * j), reverse=True))
        if a.get('allow_merge_21') and twos and ones:
            threes = rest.count(3)
            bare = [b for b in rest if b != 3]
            for j in range(1, min(twos, ones) + 1):
                add(j, sorted(bare + [3] * (threes + j) + [2] * (twos - j) + [1] * (ones - j), reverse=True))
        return out

    def lunch_for(self, cid=None):
        if cid is not None and cid in self.class_lunch:
            return self.class_lunch[cid]
        return self.lunch

    def segments(self, cid=None):
        """Öğle arası ile bölünen ardışık saat aralıkları."""
        lunch = self.lunch_for(cid)
        if lunch:
            return [(1, lunch), (lunch + 1, self.P)]
        return [(1, self.P)]

    def max_block_len(self, cid=None, span_lunch=False):
        if self.block_across_lunch or span_lunch:
            return self.P
        return max(e - s + 1 for s, e in self.segments(cid))

    def valid_starts(self, length, cid=None, span_lunch=False):
        if self.block_across_lunch or span_lunch:
            return list(range(1, self.P - length + 2))
        starts = []
        for s, e in self.segments(cid):
            for p in range(s, e - length + 2):
                starts.append(p)
        return starts

    def crosses_lunch(self, start, length, cid=None):
        lunch = self.lunch_for(cid)
        return bool(lunch) and start <= lunch < start + length - 1

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


def vocational_blocks(hours, daily):
    """Atölye dersi tek parça: günlük meslek sınırına göre bölünür (8 ve sınır 8 -> [8])."""
    daily = max(1, int(daily or 1))
    if hours <= 0:
        return []
    blocks = [daily] * (hours // daily)
    rem = hours % daily
    if rem:
        blocks.append(rem)
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
    if t == 'teacher_duty_day_max_hours':
        return f"{who_t}: nöbet gününde en fazla {p.get('max')} saat ders"
    if t == 'teacher_no_duty':
        return 'Nöbet tutmayan öğretmenler'
    if t == 'teacher_min_days_off':
        return f"{who_t}: en az {p.get('count')} boş gün"
    if t == 'teacher_max_consecutive':
        return f"{who_t}: en fazla {p.get('max')} saat üst üste"
    if t == 'subject_period_preference':
        mode = 'yalnızca' if p.get('mode') == 'only' else 'hariç'
        return f"{ctx.label_subject(p.get('subject_id'))}: belirli saatler {mode}"
    if t == 'subject_max_daily':
        return f"{ctx.label_subject(p.get('subject_id'))}: günde en fazla {p.get('max')} saat"
    names = ', '.join(ctx.label_subject(s) for s in (p.get('subject_ids') or []))
    if t == 'subjects_not_same_day':
        if p.get('scope') == 'school':
            return f'{names}: okul genelinde aynı güne gelmesin'
        return f'{names}: aynı güne gelmesin'
    if t == 'subjects_same_day':
        return f'{names}: aynı gün olsun'
    if t == 'subject_no_lunch_split':
        return f'{names}: öğle arasıyla bölünmesin'
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

    if not ctx.assignments:
        add('error', 'Hiç ders ataması yok. Önce sınıflara ders verin.')

    for a in ctx.assignments:
        blocks = ctx.blocks_of(a)
        max_len = ctx.max_block_len(a['classroom_id'], span_lunch=bool(a.get('vocational')))
        if sum(blocks) != int(a['hours']):
            add('error', f"{ctx.label_assignment(a)}: blok düzeni ({'+'.join(map(str, blocks))}) haftalık saate ({a['hours']}) eşit değil.",
                assignment_ids=[a['id']])
        if max(blocks) > max_len:
            add('error', f"{ctx.label_assignment(a)}: {max(blocks)} saatlik blok, öğle arasıyla bölünmeyen en uzun aralığa ({max_len} saat) sığmıyor.",
                assignment_ids=[a['id']])
        if len(blocks) > n_days:
            add('warning', f"{ctx.label_assignment(a)}: {len(blocks)} blok var ama {n_days} gün var; bazı bloklar aynı güne düşecek.",
                assignment_ids=[a['id']])
        if not ctx.teachers_of(a):
            add('warning', f"{ctx.label_assignment(a)}: öğretmen atanmamış; öğretmen çakışması kontrol edilmeyecek.",
                assignment_ids=[a['id']])

    for g, members in ctx.groups.items():
        hours = {int(m['hours']) for m in members}
        patterns = {tuple(ctx.blocks_of(m)) for m in members}
        if len(hours) > 1 or len(patterns) > 1:
            add('error', f'"{g}" senkron grubundaki derslerin haftalık saatleri ve blok düzenleri aynı olmalı.',
                assignment_ids=[m['id'] for m in members])

    # Kesin kapalı hücreler (kapasite hesaplarında düşülür): zaman tablosu + kesin kısıtlar.
    school_closed = ctx.closed('school', 0)
    teacher_closed = defaultdict(set)
    class_closed = defaultdict(set)
    room_closed = defaultdict(set)
    subject_closed = defaultdict(set)
    for (t, eid), cells in ctx.avail.items():
        target = {'teacher': teacher_closed, 'classroom': class_closed, 'room': room_closed,
                  'subject': subject_closed}.get(t)
        if target is not None:
            target[eid] |= cells['closed']
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
    subject_class_hours = defaultdict(int)
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        h = int(a['hours'])
        if cn not in class_seen[a['classroom_id']]:
            class_seen[a['classroom_id']].add(cn)
            class_hours[a['classroom_id']] = ctx.class_required_hours(a['classroom_id'])
        for tid in ctx.teachers_of(a):
            if cn not in teacher_seen[tid]:
                teacher_seen[tid].add(cn)
                teacher_hours[tid] += h
        if a.get('room_id'):
            room_hours[a['room_id']] += h
        subject_class_hours[(a['subject_id'], a['classroom_id'])] += h

    for cid, h in class_hours.items():
        avail = total_slots - len(class_closed[cid] | school_closed)
        if h > avail:
            add('error', f'{ctx.label_classroom(cid)}: haftalık {h} saat ders atanmış ama yalnızca {avail} açık saat var.',
                classroom_id=cid)
    for tid, h in teacher_hours.items():
        avail = total_slots - len(teacher_closed[tid] | school_closed)
        if h > avail:
            add('error', f'{ctx.label_teacher(tid)}: haftalık {h} saat dersi var ama müsait olduğu saat sayısı {avail}.',
                teacher_id=tid)
        elif h > avail * 0.9:
            add('warning', f'{ctx.label_teacher(tid)}: {h} saat ders / {avail} müsait saat; çok sıkışık, çözüm zorlaşabilir.',
                teacher_id=tid)
        cap = ctx.teacher_daily_cap(tid)
        if cap > 0 and h > cap * n_days:
            add('error', f'{ctx.label_teacher(tid)}: haftalık {h} saat ders var ama günde en fazla {cap} saat ile {n_days} günde sığmaz.',
                teacher_id=tid)
    for rid, h in room_hours.items():
        cap = int((ctx.rooms.get(rid) or {}).get('capacity') or 1)
        avail = (total_slots - len(room_closed[rid] | school_closed)) * cap
        if h > avail:
            add('error', f'{ctx.label_room(rid)}: haftalık {h} saat kullanım isteniyor ama kapasite {avail} saat.',
                room_id=rid)
    for (sid, cid), h in subject_class_hours.items():
        if not subject_closed[sid]:
            continue
        avail = total_slots - len(subject_closed[sid] | class_closed[cid] | school_closed)
        if h > avail:
            add('error', f'{ctx.label_classroom(cid)} {ctx.label_subject(sid)}: {h} saat ama dersin açık olduğu saat {avail}.',
                classroom_id=cid)

    for cid in sorted({a['classroom_id'] for a in ctx.assignments}):
        _, _, profiles = ctx.class_structure(cid)
        if profiles is None:
            continue
        chosen = set()
        for prof in (data.get('elective_profiles') or {}).get(str(cid)) or []:
            chosen |= {ctx.canon.get(i) for i in prof}
        for a in ctx.assignments:
            if a['classroom_id'] == cid and (a.get('elective_group') or '').strip() and ctx.canon[a['id']] not in chosen:
                add('warning', f'{ctx.label_assignment(a)}: seçmeli ama seçen öğrenci girilmemiş.', assignment_ids=[a['id']])

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
    # B1/B2 esnekliği olan atamalarda birden çok blok düzeni (varyant) vardır;
    # tam olarak biri seçilir, seçilmeyenin blokları boş kalır.
    x = {}           # (block_key, d, p) -> var
    blocks = defaultdict(list)   # canon aid -> [(block_key, length)]
    block_starts = {}            # block_key -> [(d, p, var)]
    variants = defaultdict(list)  # canon aid -> [(sel|None, [(block_key, length)])]
    occ = defaultdict(list)      # (canon aid, d, p) -> [var]
    starts_by_day = defaultdict(list)  # (block_key[:2] -> variant, d) -> [var]
    crossing = defaultdict(list)  # canon aid -> [öğle arasını aşan başlangıç değişkenleri]

    canon_ids = sorted({ctx.canon[a['id']] for a in ctx.assignments})
    for aid in canon_ids:
        a = ctx.by_id[aid]
        cid = a['classroom_id']
        vlist = ctx.block_variants(a)
        sels = []
        for vi, (changes, vblocks) in enumerate(vlist):
            sel = None
            if len(vlist) > 1:
                sel = m.NewBoolVar(f'var_{aid}_{vi}')
                sels.append(sel)
                if changes:
                    b.terms['block_flex'].append((int(ctx.weights['block_flex']) * changes, sel))
            vb = []
            for bi, length in enumerate(vblocks):
                key = (aid, vi, bi)
                vb.append((key, length))
                blocks[aid].append((key, length))
                vs = []
                block_starts[key] = []
                span = bool(a.get('vocational'))
                for d in days:
                    for p in ctx.valid_starts(length, cid, span_lunch=span):
                        v = m.NewBoolVar(f'x_{aid}_{vi}_{bi}_{d}_{p}')
                        x[(key, d, p)] = v
                        vs.append(v)
                        block_starts[key].append((d, p, v))
                        starts_by_day[((aid, vi), d)].append(v)
                        if ctx.crosses_lunch(p, length, cid):
                            crossing[aid].append(v)
                        for k in range(length):
                            occ[(aid, d, p + k)].append(v)
                if sel is None:
                    m.AddExactlyOne(vs)
                else:
                    m.Add(sum(vs) == sel)
            variants[aid].append((sel, vb))
        if sels:
            m.AddExactlyOne(sels)

    def occ_expr(aid, d, p):
        return sum(occ.get((ctx.canon[aid], d, p), []))

    # --- Aynı atamanın blokları farklı günlere (mümkünse) ---
    spread_lit = enforce_lit('Aynı dersin blokları farklı günlere dağılsın')
    for aid in canon_ids:
        for vi, (sel, vb) in enumerate(variants[aid]):
            if len(vb) > len(days):
                continue
            cond = [spread_lit] + ([sel] if sel is not None else [])
            for d in days:
                m.Add(sum(starts_by_day[((aid, vi), d)]) <= 1).OnlyEnforceIf(cond)
            # Simetri kırma: aynı uzunluktaki bloklar gün sırasına göre.
            for (k1, l1), (k2, l2) in zip(vb, vb[1:]):
                if l1 == l2:
                    e1 = sum(day_index[d] * v for d, _, v in block_starts[k1])
                    e2 = sum(day_index[d] * v for d, _, v in block_starts[k2])
                    m.Add(e1 < e2).OnlyEnforceIf(cond)

    # --- Şube / öğretmen meşguliyeti (senkron gruplar tekilleştirilir) ---
    class_canon = defaultdict(set)
    teacher_canon = defaultdict(set)
    room_members = defaultdict(list)
    subject_canon = defaultdict(set)
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        class_canon[a['classroom_id']].add(cn)
        subject_canon[a['subject_id']].add(cn)
        for tid in ctx.teachers_of(a):
            teacher_canon[tid].add(cn)
        if a.get('room_id'):
            room_members[a['room_id']].append(cn)

    # Şube çakışması: çekirdek dersler her şeyle çakışır; seçmeliler öğrenci profiline
    # (seçimler girildiyse) ya da seçmeli grubuna göre paralel işlenebilir.
    c_busy = {}
    for cid, cset in class_canon.items():
        core, groups, profiles = ctx.class_structure(cid)
        for d in days:
            for p in periods:
                def o(cn):
                    return sum(occ.get((cn, d, p), []))
                core_sum = sum(o(cn) for cn in core)
                if profiles is not None:
                    for prof in profiles:
                        m.Add(core_sum + sum(o(cn) for cn in prof) <= 1)
                    if not profiles:
                        m.Add(core_sum <= 1)
                else:
                    gbusy = []
                    for g, gset in sorted(groups.items()):
                        items = [o(cn) for cn in gset]
                        if len(items) == 1:
                            gbusy.append(items[0])
                            continue
                        gv = m.NewBoolVar(f'gb_{cid}_{g}_{d}_{p}')
                        for e in items:
                            m.Add(gv >= e)
                        gbusy.append(gv)
                    m.Add(core_sum + sum(gbusy) <= 1)
                v = m.NewBoolVar(f'cb_{cid}_{d}_{p}')
                items = [o(cn) for cn in cset]
                for e in items:
                    m.Add(v >= e)
                m.Add(v <= sum(items))
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

    # --- Zaman tablosu: kapalı hücre kesin, "istenmiyor" hücre cezalı ---
    def cell_expr(t, eid, d, p):
        if t == 'school':
            return sum(c_busy[(cid, d, p)] for cid in class_canon)
        if t == 'teacher':
            return t_busy.get((eid, d, p), 0)
        if t == 'classroom':
            return c_busy.get((eid, d, p), 0)
        if t == 'room':
            return r_use.get((eid, d, p), 0) if eid in room_members else 0
        return sum(sum(occ.get((cn, d, p), [])) for cn in subject_canon.get(eid, ()))

    w_avoid = int(ctx.weights['availability_avoid'])
    for (t, eid), cells in sorted(ctx.avail.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0)):
        if cells['closed']:
            expr = sum(cell_expr(t, eid, d, p) for d, p in sorted(cells['closed']))
            if not isinstance(expr, int):
                lit = enforce_lit(f'{ctx.label_entity(t, eid)}: zaman tablosunda kapalı saatler')
                m.Add(expr == 0).OnlyEnforceIf(lit)
        if cells['avoid'] and w_avoid:
            for d, p in sorted(cells['avoid']):
                e = cell_expr(t, eid, d, p)
                if not isinstance(e, int):
                    b.terms['availability_avoid'].append((w_avoid, e))

    # --- Bir dersin şubedeki günlük üst sınırı ---
    subj_daily_lit = enforce_lit('Kültür ve meslek derslerinin günlük saat sınırı')
    cs_canon = defaultdict(set)
    for a in ctx.assignments:
        cs_canon[(a['classroom_id'], a['subject_id'])].add(ctx.canon[a['id']])
    for (cid, sid), cset in cs_canon.items():
        longest = max(l for cn in cset for _, l in blocks[cn])
        vocational = bool((ctx.subjects.get(sid) or {}).get('vocational'))
        base = ctx.max_vocational_daily if vocational else ctx.max_culture_daily
        limit = max(base, longest)
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

    present_cache = {}

    def day_present(cid_, sid_, d):
        """Şubede o ders o gün var mı (0/1)."""
        key = (cid_, sid_, d)
        if key not in present_cache:
            hours = sum(sum(occ.get((cn, d, pp), [])) for cn in cs_canon.get((cid_, sid_), ()) for pp in periods)
            v = m.NewBoolVar(f'dp_{cid_}_{sid_}_{d}')
            if isinstance(hours, int):
                m.Add(v == 0)
            else:
                m.Add(hours >= v)
                m.Add(hours <= ctx.P * v)
            present_cache[key] = v
        return present_cache[key]

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

        elif ctype == 'teacher_no_duty':
            pass

        elif ctype == 'teacher_duty_day_max_hours':
            mx = max(1, min(int(p.get('max') or 4), ctx.P))
            excluded = set()
            for other in ctx.data.get('constraints', []):
                if other.get('type') != 'teacher_no_duty':
                    continue
                if other.get('is_active') is False:
                    continue
                for raw_id in (other.get('params') or {}).get('teacher_ids') or []:
                    try:
                        excluded.add(int(raw_id))
                    except (TypeError, ValueError):
                        continue
            for tid in targets_teachers(p):
                if tid in excluded or tid not in teacher_canon:
                    continue
                flags = []
                for d in days:
                    is_duty = m.NewBoolVar(f'duty_{cid}_{tid}_{d}')
                    hours = sum(t_busy[(tid, d, pp)] for pp in periods)
                    gate = [is_duty] if lit is None else [lit, is_duty]
                    if hard:
                        m.Add(hours <= mx).OnlyEnforceIf(gate)
                    else:
                        ex = m.NewIntVar(0, ctx.P, f'dutyex_{cid}_{tid}_{d}')
                        m.Add(ex >= hours - mx).OnlyEnforceIf(is_duty)
                        m.Add(ex == 0).OnlyEnforceIf(is_duty.Not())
                        b.violations[cid].append(ex)
                        b.terms['soft_constraints'].append((w, ex))
                    flags.append(is_duty)
                if flags:
                    if lit is None:
                        m.Add(sum(flags) == 1)
                    else:
                        m.Add(sum(flags) == 1).OnlyEnforceIf(lit)

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

        elif ctype in ('subjects_not_same_day', 'subjects_same_day'):
            sids = [s for s in (p.get('subject_ids') or []) if s in subject_canon]
            cls = p.get('classroom_id')
            if ctype == 'subjects_not_same_day' and p.get('scope') == 'school':
                pairs = [(c_, s) for c_ in sorted(class_canon) for s in sids if cs_canon.get((c_, s))]
                for d in days:
                    if pairs:
                        at_most(sum(day_present(c_, s, d) for c_, s in pairs), 1, f'nsdsch_{cid}_{d}')
                continue
            for c_ in sorted(class_canon):
                if cls and c_ != cls:
                    continue
                present = [s for s in sids if cs_canon.get((c_, s))]
                if len(present) < 2:
                    continue
                if ctype == 'subjects_not_same_day':
                    for d in days:
                        at_most(sum(day_present(c_, s, d) for s in present), 1, f'nsd_{cid}_{c_}_{d}')
                else:
                    # En çok blok alan ders referans; diğerlerinin günleri onun günleri içinde kalır.
                    ref = max(present, key=lambda s: max(len(vb) for cn in cs_canon[(c_, s)] for _, vb in variants[cn]))
                    for s in present:
                        if s == ref:
                            continue
                        for d in days:
                            ps, pr = day_present(c_, s, d), day_present(c_, ref, d)
                            if hard:
                                m.Add(ps <= pr).OnlyEnforceIf(lit)
                            else:
                                ex = m.NewBoolVar(f'ssd_{cid}_{c_}_{s}_{d}')
                                m.Add(ex >= ps - pr)
                                b.violations[cid].append(ex)
                                b.terms['soft_constraints'].append((w, ex))

        elif ctype == 'subject_no_lunch_split':
            sids = set(p.get('subject_ids') or [])
            cls = p.get('classroom_id')
            vars_ = [v for (c_, s_), cset in cs_canon.items() if s_ in sids and (not cls or c_ == cls)
                     for cn in cset for v in crossing.get(cn, [])]
            if vars_:
                zero(sum(vars_))

    # --- Dağıtım parametreleri: günlük tavan ve aynı sınıfta farklı ders ---
    if ctx.use_distribution:
        for tid in teacher_canon:
            cap = ctx.teacher_daily_cap(tid)
            if cap > 0:
                lit = enforce_lit(f'{ctx.label_teacher(tid)}: günde en fazla {cap} saat')
                for d in days:
                    m.Add(sum(t_busy[(tid, d, pp)] for pp in periods) <= cap).OnlyEnforceIf(lit)

        tc_subjects = defaultdict(set)
        for a in ctx.assignments:
            for tid in ctx.teachers_of(a):
                tc_subjects[(tid, a['classroom_id'])].add(a['subject_id'])
        same_hard = None
        w_same = int(ctx.weights['soft_constraint'])
        for (tid, cid), sids in sorted(tc_subjects.items()):
            mode = ctx.teacher_same_class_mode(tid)
            if mode == 'off' or len(sids) < 2:
                continue
            present_sids = [s for s in sids if cs_canon.get((cid, s))]
            if len(present_sids) < 2:
                continue
            for d in days:
                present = sum(day_present(cid, s, d) for s in present_sids)
                if mode == 'hard':
                    if same_hard is None:
                        same_hard = enforce_lit('Öğretmenin aynı sınıfa verdiği farklı dersler aynı güne gelmesin')
                    m.Add(present <= 1).OnlyEnforceIf(same_hard)
                elif w_same:
                    ex = m.NewIntVar(0, len(present_sids), f'scs_{tid}_{cid}_{d}')
                    m.Add(ex >= present - 1)
                    b.terms['soft_constraints'].append((w_same, ex))

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
    w_off = int(ctx.weights.get('teacher_day_off') or 0)
    need_gaps = bool(wg) or any(ctx.teacher_window_cap(tid) > 0 for tid in teacher_canon)
    need_off = bool(w_off) and any(ctx.teacher_wants_day_off(tid) for tid in teacher_canon)
    gap_vars = defaultdict(list)
    if need_gaps or ws or need_off:
        for tid in teacher_canon:
            offs = []
            for d in days:
                seq = [t_busy[(tid, d, pp)] for pp in periods]
                if need_gaps:
                    for s, e in ctx.segments():
                        sub = seq[s - 1:e]
                        before = prefix_or(sub, f'tgb_{tid}_{d}_{s}')
                        after = list(reversed(prefix_or(list(reversed(sub)), f'tga_{tid}_{d}_{s}')))
                        for i, v in enumerate(sub):
                            if before[i] is None or after[i] is None:
                                continue
                            g = m.NewBoolVar(f'tg_{tid}_{d}_{s}_{i}')
                            m.Add(g >= before[i] + after[i] - v - 1)
                            gap_vars[tid].append(g)
                            if wg:
                                b.terms['teacher_gaps'].append((wg, g))
                if ws:
                    tot = sum(seq)
                    used = m.NewBoolVar(f'tu_{tid}_{d}')
                    for v in seq:
                        m.Add(used >= v)
                    single = m.NewBoolVar(f'ts_{tid}_{d}')
                    m.Add(single >= 2 * used - tot)
                    b.terms['teacher_single_hour_day'].append((ws, single))
                if need_off and ctx.teacher_wants_day_off(tid):
                    off = m.NewBoolVar(f'toffd_{tid}_{d}')
                    tot = sum(seq)
                    m.Add(tot == 0).OnlyEnforceIf(off)
                    m.Add(tot >= 1).OnlyEnforceIf(off.Not())
                    offs.append(off)
            if offs:
                hours = sum(int(ctx.by_id[cn]['hours']) for cn in teacher_canon[tid])
                if hours <= (len(days) - 1) * ctx.P:
                    missing = m.NewBoolVar(f'toff_{tid}')
                    m.Add(sum(offs) == 0).OnlyEnforceIf(missing)
                    m.Add(sum(offs) >= 1).OnlyEnforceIf(missing.Not())
                    b.terms['teacher_day_off'].append((w_off, missing))
        for tid, gs in gap_vars.items():
            cap = ctx.teacher_window_cap(tid)
            if cap > 0 and gs:
                lit = enforce_lit(f'{ctx.label_teacher(tid)}: en fazla {cap} pencere')
                m.Add(sum(gs) <= cap).OnlyEnforceIf(lit)

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
    b.block_starts = block_starts
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


def _strategies_for(ctx):
    # CP-SAT işçileri portföy aramasını zaten birlikte yürütür.
    # Ayrı algoritmalar (kurucu ve yerel arama) bunun dışında kıyaslanır.
    return SEARCH_STRATEGIES[:1]


def _apply_search(solver, extra, data):
    branching = extra.get('search_branching_name')
    if branching:
        value = getattr(cp_model, branching, None)
        if value is not None and hasattr(solver.parameters, 'search_branching'):
            solver.parameters.search_branching = value
    for key in ('random_seed', 'randomize_search', 'linearization_level'):
        if key in extra and hasattr(solver.parameters, key):
            setattr(solver.parameters, key, extra[key])
    if data.get('seed') is not None and 'random_seed' not in extra:
        solver.parameters.random_seed = int(data['seed'])


def solve(data, on_progress=None, should_stop=None):
    pre = check(data)
    if not pre['ok']:
        return {'status': 'INVALID', 'lessons': [], 'score': {}, 'violations': [], 'diagnostics': pre['issues']}

    ctx = Ctx(data)
    t0 = time.time()
    from timetable_heuristics import (
        ALGORITHMS,
        cells_of,
        comparison_note,
        finish_comparison,
        penalty_of,
        run_heuristics,
        selected_algorithms,
    )

    chosen = selected_algorithms(ctx)
    comparisons = []
    heuristic_pack = None
    if any(name in chosen for name in ('greedy', 'local')):
        pack, rows = run_heuristics(ctx, chosen, should_stop=should_stop, on_progress=on_progress)
        comparisons.extend(rows)
        if pack and pack[0]:
            quality = penalty_of(ctx, cells_of(ctx, pack[0]))
            if quality['ok']:
                heuristic_pack = (pack[0], pack[1], quality)

    if 'cpsat' not in chosen:
        diagnostics = [i for i in pre['issues'] if i['level'] == 'warning']
        finish_comparison(comparisons)
        note = comparison_note(comparisons)
        if note:
            diagnostics.insert(0, {'level': 'warning', 'message': note})
        if not heuristic_pack:
            diagnostics.insert(0, {
                'level': 'error',
                'message': 'Seçilen algoritmalar program çıkaramadı.',
            })
            return {'status': 'INFEASIBLE', 'lessons': [], 'score': {}, 'violations': [],
                    'diagnostics': diagnostics, 'comparisons': comparisons, 'comparison_note': note,
                    'wall_time': round(time.time() - t0, 1)}
        lessons, name, quality = heuristic_pack
        label = dict(ALGORITHMS).get(name, name)
        return {
            'status': 'FEASIBLE',
            'objective': quality['penalty'],
            'best_bound': quality['penalty'],
            'wall_time': round(time.time() - t0, 1),
            'solutions': 1,
            'strategy': name,
            'strategy_label': label,
            'lessons': lessons,
            'score': quality['score'],
            'violations': [],
            'diagnostics': diagnostics,
            'comparisons': comparisons,
            'comparison_note': note,
        }

    b = build(ctx)
    time_limit = float(data.get('time_limit') or ctx.distribution.get('place_seconds') or 60)
    workers = int(data.get('workers') or (ctx.distribution.get('workers') if ctx.use_distribution else None) or 4)
    if ctx.use_distribution:
        gap_budget = float(ctx.distribution.get('gap_seconds') or 0)
    else:
        gap_budget = None

    def make_solver(limit, extra=None):
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = max(1.0, limit)
        s.parameters.num_workers = workers
        _apply_search(s, extra or {}, data)
        return s

    def emit(name, label, message, solutions=0):
        if not on_progress:
            return
        on_progress({
            'strategy': name,
            'strategy_label': label,
            'message': message,
            'solutions': solutions,
            'elapsed': round(time.time() - t0, 1),
        })

    def progress_for(name, label, message):
        if not on_progress:
            return None

        def inner(p):
            payload = dict(p)
            payload['strategy'] = name
            payload['strategy_label'] = label
            payload['message'] = message
            payload['elapsed'] = round(time.time() - t0, 1)
            on_progress(payload)

        return inner

    # 1. aşama: amaçsız geçerli bir program. Bulunamazsa (süre biterse) başka arama
    # yöntemi denenir. Modelin kendisi çözümsüzse yöntem değiştirmek sonucu değiştirmez.
    found = None
    last_status = None
    tried = []
    stopped = False
    solutions = 0
    cpsat_started = time.time()
    for name, label, extra in _strategies_for(ctx):
        if should_stop and should_stop():
            stopped = True
            break
        tried.append(label)
        emit(name, label, f'{label} deneniyor')
        feas = b.model.Clone()
        feas.ClearObjective()
        solver = make_solver(time_limit, extra)
        cb = _Callback(progress_for(name, label, f'{label} deneniyor'), should_stop)
        st = solver.Solve(feas, cb)
        solutions += cb.count
        last_status = st
        if st in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            found = (name, label, solver)
            break
        if st == cp_model.INFEASIBLE:
            break
        if should_stop and should_stop():
            stopped = True
            break

    strategy_name, strategy_label = (found[0], found[1]) if found else (None, None)

    # 2. aşama: bulunan program ipucu verilerek iyileştirilir (pencere, boş gün, şube sıkışıklığı).
    if found and b.terms:
        name, label, feas_solver = found
        hint = list(feas_solver.ResponseProto().solution)
        proto = b.model.Proto()
        proto.solution_hint.vars.extend(range(len(hint)))
        proto.solution_hint.values.extend(hint)
        improve_for = gap_budget if gap_budget is not None else time_limit - (time.time() - t0)
        improve_msg = 'Pencereler azaltılıyor' if int(ctx.weights.get('teacher_gaps') or 0) else 'Program iyileştiriliyor'
        if improve_for >= 2 and not (should_stop and should_stop()):
            emit(name, label, improve_msg, solutions)
            solver = make_solver(improve_for)
            cb = _Callback(progress_for(name, label, improve_msg), should_stop)
            st = solver.Solve(b.model, cb)
            solutions += cb.count
        else:
            st = cp_model.UNKNOWN
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            solver = make_solver(10)
            solver.parameters.fix_variables_to_their_hinted_value = True
            st = solver.Solve(b.model)
            if st == cp_model.OPTIMAL:
                st = cp_model.FEASIBLE
    elif found:
        name, label, feas_solver = found
        hint = list(feas_solver.ResponseProto().solution)
        proto = b.model.Proto()
        proto.solution_hint.vars.extend(range(len(hint)))
        proto.solution_hint.values.extend(hint)
        solver = make_solver(10)
        solver.parameters.fix_variables_to_their_hinted_value = True
        st = solver.Solve(b.model)
        if st == cp_model.OPTIMAL:
            st = cp_model.FEASIBLE
    else:
        st = last_status if last_status is not None else cp_model.UNKNOWN
        solver = None

    status = STATUS_NAMES.get(st, str(st))
    diagnostics = [i for i in pre['issues'] if i['level'] == 'warning']

    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        if stopped or (should_stop and should_stop()):
            status = 'CANCELLED'
        elif st == cp_model.INFEASIBLE:
            core = _diagnose(ctx)
            if core:
                diagnostics.insert(0, {
                    'level': 'error',
                    'message': 'Bu kesin kurallar birlikte sağlanamıyor: ' + '; '.join(c['label'] for c in core)
                               + '. Birini esnek yapın veya kaldırın. Arama yöntemini değiştirmek bu çelişkiyi çözmez.',
                    'constraint_ids': [c['constraint_id'] for c in core if c['constraint_id']],
                })
            else:
                diagnostics.insert(0, {
                    'level': 'error',
                    'message': 'Öğretmen/şube/mekan çakışmaları nedeniyle çözüm yok. Öğretmen yüklerini ve mekan kapasitelerini kontrol edin.',
                })
        else:
            diagnostics.insert(0, {
                'level': 'error',
                'message': 'Denenen yöntemler süre içinde program bulamadı: '
                           + ', '.join(tried)
                           + '. Dağıtım süresini uzatın veya blokların bölünüp birleşmesine izin verin.',
            })
        if heuristic_pack:
            lessons, name, quality = heuristic_pack
            label = dict(ALGORITHMS).get(name, name)
            finish_comparison(comparisons)
            note = comparison_note(comparisons)
            if note:
                diagnostics.insert(0, {'level': 'warning', 'message': note})
            diagnostics.insert(0, {
                'level': 'warning',
                'message': f'Kısıt çözücü program çıkaramadı. {label} sonucu kullanıldı.',
            })
            return {
                'status': 'FEASIBLE',
                'objective': quality['penalty'],
                'best_bound': quality['penalty'],
                'wall_time': round(time.time() - t0, 1),
                'solutions': solutions,
                'strategy': name,
                'strategy_label': label,
                'lessons': lessons,
                'score': quality['score'],
                'violations': [],
                'diagnostics': diagnostics,
                'comparisons': comparisons,
                'comparison_note': note,
            }
        finish_comparison(comparisons)
        return {'status': status, 'lessons': [], 'score': {}, 'violations': [], 'diagnostics': diagnostics,
                'comparisons': comparisons, 'comparison_note': comparison_note(comparisons),
                'wall_time': round(time.time() - t0, 1), 'strategy': strategy_name, 'strategy_label': strategy_label}

    lessons = []
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        for key, length in b.blocks[cn]:
            for d, p, v in b.block_starts[key]:
                if solver.Value(v):
                    for k in range(length):
                        lessons.append({'assignment_id': a['id'], 'day': d, 'period': p + k,
                                        'room_id': a.get('room_id')})

    def val(e):
        return int(solver.Value(e)) if not isinstance(e, int) else e

    score = {comp: sum(val(e) for _, e in items) for comp, items in b.terms.items()}
    violations = [{'constraint_id': cid, 'count': sum(val(e) for e in exprs)}
                  for cid, exprs in b.violations.items()]
    violations = [v for v in violations if v['count'] > 0]

    cpsat_quality = penalty_of(ctx, cells_of(ctx, lessons))
    if cpsat_quality['ok']:
        comparisons.append({
            'algorithm': 'cpsat',
            'label': 'Kısıt çözücü',
            'ok': True,
            'penalty': cpsat_quality['penalty'],
            'gaps': cpsat_quality['gaps'],
            'seconds': round(time.time() - cpsat_started, 1),
            'delta': None,
            'winner': False,
            'note': None,
        })
    else:
        comparisons.append({
            'algorithm': 'cpsat',
            'label': 'Kısıt çözücü',
            'ok': True,
            'penalty': int(solver.ObjectiveValue() if b.terms else 0),
            'gaps': score.get('teacher_gaps'),
            'seconds': round(time.time() - cpsat_started, 1),
            'delta': None,
            'winner': False,
            'note': 'Ortak ceza ölçeğine tam oturmadı; kendi cezası yazıldı',
        })
    winner = finish_comparison(comparisons)
    if not cpsat_quality['ok']:
        for row in comparisons:
            row['winner'] = row['algorithm'] == 'cpsat'
            row['delta'] = 0 if row['algorithm'] == 'cpsat' else None
        winner = next((row for row in comparisons if row['algorithm'] == 'cpsat'), winner)
        note = 'Kurucu algoritmanın cezası kısıt çözücüyle aynı ölçeğe oturmadı. Kısıt çözücünün programı kullanıldı.'
    else:
        note = comparison_note(comparisons)
    if note:
        diagnostics.insert(0, {'level': 'warning', 'message': note})
    if cpsat_quality['ok'] and winner and winner['algorithm'] != 'cpsat' and heuristic_pack and winner['algorithm'] == heuristic_pack[1]:
        lessons = heuristic_pack[0]
        score = heuristic_pack[2]['score']
        strategy_name = heuristic_pack[1]
        strategy_label = dict(ALGORITHMS).get(strategy_name, strategy_name)
        status = 'FEASIBLE'
        objective = heuristic_pack[2]['penalty']
        violations = []
    else:
        objective = solver.ObjectiveValue() if b.terms else 0

    return {
        'status': status,
        'objective': objective,
        'best_bound': solver.BestObjectiveBound() if b.terms else 0,
        'wall_time': round(time.time() - t0, 1),
        'solutions': solutions,
        'strategy': strategy_name,
        'strategy_label': strategy_label,
        'lessons': lessons,
        'score': score,
        'violations': violations,
        'diagnostics': diagnostics,
        'comparisons': comparisons,
        'comparison_note': note,
    }
