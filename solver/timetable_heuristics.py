"""CP-SAT dışında iki algoritma.

Sıkışık ders önce: en dolu öğretmen ve şubenin bloklarını sırayla yerleştirir.
Yerel iyileştirme: yerleşen programda blokları taşıyarak pencere ve boşluk cezasını düşürür.

İkisi de kesin kuralları bozan programı kabul etmez. Ceza, kısıt çözücüyle aynı
kalemlerden hesaplanır; rapordaki fark bu ortak cezadır.
"""

import random
import time
from collections import defaultdict

SUPPORTED_HARD = {
    'teacher_unavailable',
    'classroom_unavailable',
    'room_unavailable',
    'teacher_max_daily_hours',
    'teacher_max_consecutive',
    'subject_period_preference',
    'subject_max_daily',
    'subjects_not_same_day',
    'subject_no_lunch_split',
}

ALGORITHMS = (
    ('cpsat', 'Kısıt çözücü'),
    ('greedy', 'Sıkışık ders önce'),
    ('local', 'Yerel iyileştirme'),
)


def selected_algorithms(ctx):
    if not ctx.use_distribution:
        return ['cpsat']
    raw = (ctx.data.get('distribution') or {})
    if isinstance(raw.get('algorithms'), list) and raw.get('algorithms'):
        picked = [a for a in raw['algorithms'] if a in ('cpsat', 'greedy', 'local')]
        return picked or ['cpsat']
    if raw.get('methods') == 'single':
        return ['cpsat']
    return ['cpsat', 'greedy', 'local']


def _members(ctx):
    groups = defaultdict(list)
    for a in ctx.assignments:
        groups[ctx.canon[a['id']]].append(a)
    return groups


def _unsupported(ctx):
    if ctx.data.get('locked'):
        return 'Kilitli ders varken bu algoritma çalışmaz'
    for c in ctx.data.get('constraints') or []:
        if c.get('hard') and c.get('type') not in SUPPORTED_HARD:
            return 'Bu kesin kural yalnız kısıt çözücüde denetleniyor'
    return None


def _hard_maps(ctx):
    """Kesin kurallardan hücre ve tavan haritaları."""
    unavail = {'teacher': defaultdict(set), 'classroom': defaultdict(set), 'room': defaultdict(set)}
    daily = {}
    consecutive = {}
    subj_daily = []
    forbid = []  # (sid, cid|None, cells)
    not_same = []
    no_lunch = []
    for c in ctx.data.get('constraints') or []:
        if not c.get('hard'):
            continue
        t = c.get('type')
        p = c.get('params') or {}
        if t in unavail:
            cells = ctx.cells_from_slots(p.get('slots'))
            key = p.get(f'{t}_id') if t != 'teacher' else p.get('teacher_id')
            # teacher / classroom / room
            id_key = {'teacher': 'teacher_id', 'classroom': 'classroom_id', 'room': 'room_id'}[t]
            eid = p.get(id_key)
            if t == 'teacher' and not eid:
                for tid in ctx.teachers:
                    unavail['teacher'][tid] |= cells
            elif eid:
                unavail[t][eid] |= cells
        elif t == 'teacher_max_daily_hours':
            mx = int(p.get('max') or ctx.P)
            if p.get('teacher_id'):
                daily[p['teacher_id']] = min(daily.get(p['teacher_id'], mx), mx)
            else:
                for tid in ctx.teachers:
                    daily[tid] = min(daily.get(tid, mx), mx)
        elif t == 'teacher_max_consecutive':
            mx = int(p.get('max') or ctx.P)
            if p.get('teacher_id'):
                consecutive[p['teacher_id']] = min(consecutive.get(p['teacher_id'], mx), mx)
            else:
                for tid in ctx.teachers:
                    consecutive[tid] = min(consecutive.get(tid, mx), mx)
        elif t == 'subject_max_daily':
            subj_daily.append((p.get('subject_id'), p.get('classroom_id'), int(p.get('max') or ctx.P)))
        elif t == 'subject_period_preference':
            days = [int(d) for d in (p.get('days') or []) if int(d) in ctx.days] or list(ctx.days)
            periods = {int(x) for x in (p.get('periods') or []) if 1 <= int(x) <= ctx.P}
            cells = set()
            if (p.get('mode') or 'avoid') == 'only':
                for d in ctx.days:
                    for pp in ctx.periods:
                        if not (d in days and pp in periods):
                            cells.add((d, pp))
            else:
                for d in days:
                    for pp in periods:
                        cells.add((d, pp))
            forbid.append((p.get('subject_id'), p.get('classroom_id'), cells))
        elif t == 'subjects_not_same_day':
            not_same.append((set(p.get('subject_ids') or []), p.get('classroom_id'), p.get('scope')))
        elif t == 'subject_no_lunch_split':
            no_lunch.append((set(p.get('subject_ids') or []), p.get('classroom_id')))
    return {
        'unavail': unavail,
        'daily': daily,
        'consecutive': consecutive,
        'subj_daily': subj_daily,
        'forbid': forbid,
        'not_same': not_same,
        'no_lunch': no_lunch,
    }


class Board:
    def __init__(self, ctx, hard):
        self.ctx = ctx
        self.hard = hard
        self.members = _members(ctx)
        self.cells = defaultdict(set)          # canon -> {(d,p)}
        self.teacher = defaultdict(set)        # tid -> {(d,p)}
        self.room = defaultdict(int)           # (rid,d,p) -> count
        self.at_class = defaultdict(list)      # (cid,d,p) -> [canon]
        self.changes = {}

    def copy(self):
        other = Board(self.ctx, self.hard)
        other.cells = defaultdict(set, {k: set(v) for k, v in self.cells.items()})
        other.teacher = defaultdict(set, {k: set(v) for k, v in self.teacher.items()})
        other.room = defaultdict(int, self.room)
        other.at_class = defaultdict(list, {k: list(v) for k, v in self.at_class.items()})
        other.changes = dict(self.changes)
        return other

    def _class_free(self, cid, cn, d, p):
        core, groups, profiles = self.ctx.class_structure(cid)
        busy = self.at_class.get((cid, d, p)) or []
        if cn in core:
            return not busy
        if any(other in core for other in busy):
            return False
        if profiles is not None:
            for other in busy:
                for prof in profiles:
                    if cn in prof and other in prof:
                        return False
            return True
        my_group = None
        for name, cans in groups.items():
            if cn in cans:
                my_group = name
                break
        for other in busy:
            og = None
            for name, cans in groups.items():
                if other in cans:
                    og = name
                    break
            if og != my_group:
                return False
        return True

    def _consecutive_ok(self, tid, d, extra):
        mx = self.hard['consecutive'].get(tid)
        if not mx:
            return True
        have = {p for dd, p in self.teacher[tid] if dd == d}
        have |= set(extra)
        run = 0
        for p in self.ctx.periods:
            run = run + 1 if p in have else 0
            if run > mx:
                return False
        return True

    def can_place(self, cn, d, start, length, days_used):
        ctx = self.ctx
        if days_used is not None and d in days_used:
            return False
        periods = list(range(start, start + length))
        school = ctx.closed('school', 0)
        added_teacher = defaultdict(list)
        room_need = defaultdict(int)
        for a in self.members[cn]:
            if a.get('room_id'):
                room_need[a['room_id']] += 1
        for a in self.members[cn]:
            cid = a['classroom_id']
            sid = a['subject_id']
            span = bool(a.get('vocational'))
            if start not in ctx.valid_starts(length, cid, span_lunch=span):
                return False
            if ctx.crosses_lunch(start, length, cid) and not (ctx.block_across_lunch or span):
                return False
            for sids, only_class in self.hard['no_lunch']:
                if sid in sids and (not only_class or only_class == cid) and ctx.crosses_lunch(start, length, cid):
                    return False
            for p in periods:
                if (d, p) in school or (d, p) in ctx.closed('classroom', cid) or (d, p) in ctx.closed('subject', sid):
                    return False
                if (d, p) in self.hard['unavail']['classroom'][cid]:
                    return False
                if not self._class_free(cid, cn, d, p):
                    return False
                if (d, p) in self.cells[cn]:
                    return False
                for fs, fc, cells in self.hard['forbid']:
                    if fs == sid and (not fc or fc == cid) and (d, p) in cells:
                        return False
                for tid in ctx.teachers_of(a):
                    if (d, p) in ctx.closed('teacher', tid) or (d, p) in self.hard['unavail']['teacher'][tid]:
                        return False
                    if (d, p) in self.teacher[tid]:
                        return False
                    added_teacher[tid].append(p)
                rid = a.get('room_id')
                if rid:
                    cap = int((ctx.rooms.get(rid) or {}).get('capacity') or 1)
                    if (d, p) in ctx.closed('room', rid) or (d, p) in self.hard['unavail']['room'][rid]:
                        return False
                    if self.room[(rid, d, p)] + room_need[rid] > cap:
                        return False
            have = 0
            for other, cells in self.cells.items():
                for oa in self.members[other]:
                    if oa['classroom_id'] == cid and oa['subject_id'] == sid:
                        have += sum(1 for dd, _ in cells if dd == d)
                        break
            limit = _subject_daily_limit(ctx, a)
            for sid2, cid2, mx in self.hard['subj_daily']:
                if sid2 == sid and (not cid2 or cid2 == cid):
                    limit = min(limit, mx)
            if have + length > limit:
                return False
        for tid, extra in added_teacher.items():
            cap = ctx.teacher_daily_cap(tid)
            rule = self.hard['daily'].get(tid)
            if rule:
                cap = rule if cap <= 0 else min(cap, rule)
            if cap > 0:
                have = sum(1 for dd, _ in self.teacher[tid] if dd == d)
                if have + len(extra) > cap:
                    return False
            if not self._consecutive_ok(tid, d, extra):
                return False
        for sids, only_class, scope in self.hard['not_same']:
            for a in self.members[cn]:
                if a['subject_id'] not in sids:
                    continue
                if only_class and a['classroom_id'] != only_class and scope != 'school':
                    continue
                targets = [a['classroom_id']] if scope != 'school' else list({m['classroom_id'] for m in ctx.assignments})
                for cid in targets:
                    if only_class and scope != 'school' and cid != only_class:
                        continue
                    others = set()
                    for other, cells in self.cells.items():
                        if not any(dd == d for dd, _ in cells):
                            continue
                        for oa in self.members[other]:
                            if oa['subject_id'] in sids and oa['subject_id'] != a['subject_id'] and (
                                scope == 'school' or oa['classroom_id'] == cid
                            ):
                                others.add(oa['subject_id'])
                    if others:
                        return False
        return True

    def place(self, cn, d, start, length):
        for p in range(start, start + length):
            self.cells[cn].add((d, p))
            for a in self.members[cn]:
                self.at_class[(a['classroom_id'], d, p)].append(cn)
                for tid in self.ctx.teachers_of(a):
                    self.teacher[tid].add((d, p))
                rid = a.get('room_id')
                if rid:
                    self.room[(rid, d, p)] += 1

    def remove(self, cn, d, start, length):
        for p in range(start, start + length):
            self.cells[cn].discard((d, p))
            for a in self.members[cn]:
                bucket = self.at_class.get((a['classroom_id'], d, p))
                if bucket and cn in bucket:
                    bucket.remove(cn)
                for tid in self.ctx.teachers_of(a):
                    still = False
                    for other, cells in self.cells.items():
                        if (d, p) in cells and any(tid in self.ctx.teachers_of(m) for m in self.members[other]):
                            still = True
                            break
                    if not still:
                        self.teacher[tid].discard((d, p))
                rid = a.get('room_id')
                if rid:
                    self.room[(rid, d, p)] -= 1


def _subject_daily_limit(ctx, a):
    sid = a['subject_id']
    vocational = bool(a.get('vocational') or (ctx.subjects.get(sid) or {}).get('vocational'))
    base = ctx.max_vocational_daily if vocational else ctx.max_culture_daily
    longest = max((length for _, blocks in ctx.block_variants(a) for length in blocks), default=1)
    return max(base, longest)


def _runs(cells):
    by_day = defaultdict(list)
    for d, p in cells:
        by_day[d].append(p)
    runs = []
    for d, periods in by_day.items():
        periods = sorted(periods)
        start = prev = periods[0]
        for p in periods[1:]:
            if p == prev + 1:
                prev = p
                continue
            runs.append((d, start, prev - start + 1))
            start = prev = p
        runs.append((d, start, prev - start + 1))
    return runs


def _match_changes(ctx, cn, cells):
    runs = _runs(cells)
    lengths = sorted(length for _, _, length in runs)
    best = None
    for changes, blocks in ctx.block_variants(ctx.by_id[cn]):
        if sorted(blocks) != lengths:
            continue
        if len(blocks) <= len(ctx.days) and len(runs) != len({d for d, _, _ in runs}):
            continue
        if best is None or changes < best:
            best = changes
    return best


def penalty_of(ctx, cells_by_canon, changes_by_canon=None):
    """Ortak ceza. ok False ise program kesin kuralı bozuyor."""
    members = _members(ctx)
    for cn, a_list in members.items():
        need = int(a_list[0]['hours'])
        if len(cells_by_canon.get(cn) or ()) != need:
            return {'ok': False, 'note': f"{ctx.label_assignment(a_list[0])} eksik yerleşti"}
        changes = _match_changes(ctx, cn, cells_by_canon[cn])
        if changes is None:
            return {'ok': False, 'note': f"{ctx.label_assignment(a_list[0])} blok düzenine uymuyor"}
        if changes_by_canon is not None:
            changes_by_canon.setdefault(cn, changes)

    teacher_at = defaultdict(list)
    class_at = defaultdict(list)
    for cn, cells in cells_by_canon.items():
        for d, p in cells:
            for a in members[cn]:
                class_at[(a['classroom_id'], d, p)].append(cn)
                for tid in ctx.teachers_of(a):
                    teacher_at[(tid, d, p)].append(cn)
                if (d, p) in ctx.closed('school', 0) or (d, p) in ctx.closed('teacher', tid) \
                        or (d, p) in ctx.closed('classroom', a['classroom_id']) \
                        or (d, p) in ctx.closed('subject', a['subject_id']):
                    return {'ok': False, 'note': 'Kapalı saate ders konmuş'}
                rid = a.get('room_id')
                if rid and (d, p) in ctx.closed('room', rid):
                    return {'ok': False, 'note': 'Kapalı mekana ders konmuş'}

    for key, cans in teacher_at.items():
        if len(cans) > 1:
            return {'ok': False, 'note': 'Öğretmen aynı saatte iki derste'}
    for (cid, d, p), cans in class_at.items():
        core, groups, profiles = ctx.class_structure(cid)
        if sum(1 for cn in cans if cn in core) > 1:
            return {'ok': False, 'note': 'Şube aynı saatte iki derste'}
        elect = [cn for cn in cans if cn not in core]
        if elect and any(cn in core for cn in cans):
            return {'ok': False, 'note': 'Seçmeli ders çekirdek dersle çakışıyor'}
        if profiles is not None:
            for i, a_cn in enumerate(elect):
                for b_cn in elect[i + 1:]:
                    if any(a_cn in prof and b_cn in prof for prof in profiles):
                        return {'ok': False, 'note': 'Aynı öğrencinin seçmelileri çakışıyor'}
        elif len({next((name for name, cs in groups.items() if cn in cs), None) for cn in elect}) > 1:
            return {'ok': False, 'note': 'Farklı seçmeli grupları çakışıyor'}

    weights = ctx.weights
    gaps = 0
    compact = 0
    single = 0
    late = 0
    avoid = 0
    flex = sum(changes_by_canon.get(cn, 0) if changes_by_canon else (_match_changes(ctx, cn, cells) or 0)
               for cn, cells in cells_by_canon.items())
    day_off = 0
    same = 0

    teachers = {tid for cn in cells_by_canon for a in members[cn] for tid in ctx.teachers_of(a)}
    for tid in teachers:
        days_on = []
        teacher_gaps = 0
        for d in ctx.days:
            seq = [1 if (tid, d, p) in teacher_at else 0 for p in ctx.periods]
            if sum(seq) == 1:
                single += 1
            if sum(seq) == 0:
                days_on.append(0)
            else:
                days_on.append(1)
            for s, e in ctx.segments():
                sub = seq[s - 1:e]
                seen = False
                for i, v in enumerate(sub):
                    if v:
                        seen = True
                        continue
                    if seen and any(sub[i + 1:]):
                        teacher_gaps += 1
        gaps += teacher_gaps
        cap = ctx.teacher_window_cap(tid)
        if cap > 0 and teacher_gaps > cap:
            return {'ok': False, 'note': f'{ctx.label_teacher(tid)} pencere sınırı aşıldı'}
        hours = sum(len(cells_by_canon[cn]) for cn in cells_by_canon
                    if any(tid in ctx.teachers_of(a) for a in members[cn]))
        # sync ile aynı canon bir kez sayıldı
        if ctx.teacher_wants_day_off(tid) and hours <= (len(ctx.days) - 1) * ctx.P and not any(v == 0 for v in days_on):
            day_off += 1
        cap_d = ctx.teacher_daily_cap(tid)
        if cap_d > 0:
            for d in ctx.days:
                if sum(1 for p in ctx.periods if (tid, d, p) in teacher_at) > cap_d:
                    return {'ok': False, 'note': f'{ctx.label_teacher(tid)} günlük saat sınırı aşıldı'}

    classes = {a['classroom_id'] for cn in cells_by_canon for a in members[cn]}
    for cid in classes:
        for d in ctx.days:
            seq = [1 if class_at.get((cid, d, p)) else 0 for p in ctx.periods]
            for i, v in enumerate(seq):
                if not v and any(seq[i + 1:]):
                    compact += 1

    for cn, cells in cells_by_canon.items():
        a = ctx.by_id[cn]
        if (ctx.subjects.get(a['subject_id']) or {}).get('hard'):
            late += sum(1 for _, p in cells if p >= ctx.P - 1)
        avoid_cells = (ctx.avail.get(('subject', a['subject_id'])) or {}).get('avoid', set())
        avoid += sum(1 for cell in cells if cell in avoid_cells)
        for a2 in members[cn]:
            for tid in ctx.teachers_of(a2):
                avoid += sum(1 for cell in cells if cell in (ctx.avail.get(('teacher', tid)) or {}).get('avoid', set()))
            avoid += sum(1 for cell in cells if cell in (ctx.avail.get(('classroom', a2['classroom_id'])) or {}).get('avoid', set()))

    # Aynı sınıfta öğretmenin farklı dersleri
    pair = defaultdict(lambda: defaultdict(set))
    for cn, cells in cells_by_canon.items():
        for a in members[cn]:
            for tid in ctx.teachers_of(a):
                for d, _ in cells:
                    pair[(tid, a['classroom_id'])][d].add(a['subject_id'])
    for (tid, cid), days in pair.items():
        mode = ctx.teacher_same_class_mode(tid)
        for sids in days.values():
            if len(sids) <= 1:
                continue
            if mode == 'hard':
                return {'ok': False, 'note': 'Aynı sınıfa farklı dersler aynı güne gelmiş'}
            if mode == 'soft':
                same += len(sids) - 1

    w = lambda k: int(weights.get(k) or 0)  # noqa: E731
    penalty = (
        w('teacher_gaps') * gaps
        + w('class_compact') * compact
        + w('teacher_single_hour_day') * single
        + w('hard_subject_late') * late
        + w('availability_avoid') * avoid
        + w('block_flex') * flex
        + w('teacher_day_off') * day_off
        + w('soft_constraint') * same
    )
    return {
        'ok': True,
        'penalty': penalty,
        'gaps': gaps,
        'note': None,
        'score': {
            'teacher_gaps': gaps,
            'class_compact': compact,
            'teacher_single_hour_day': single,
            'hard_subject_late': late,
            'availability_avoid': avoid,
            'block_flex': flex,
            'teacher_day_off': day_off,
            'soft_constraints': same,
        },
    }


def lessons_of(ctx, cells_by_canon):
    members = _members(ctx)
    out = []
    for a in ctx.assignments:
        cn = ctx.canon[a['id']]
        for d, p in sorted(cells_by_canon.get(cn) or ()):
            out.append({'assignment_id': a['id'], 'day': d, 'period': p, 'room_id': a.get('room_id')})
    return out


def cells_of(ctx, lessons):
    by = defaultdict(set)
    for lesson in lessons or []:
        a = ctx.by_id.get(lesson.get('assignment_id'))
        if not a:
            continue
        by[ctx.canon[a['id']]].add((int(lesson['day']), int(lesson['period'])))
    return by


def _cheap(ctx, board, cn, d, start, length, rnd):
    cost = start
    hard = (ctx.subjects.get(ctx.by_id[cn]['subject_id']) or {}).get('hard')
    if hard and start >= ctx.P - 1:
        cost += 8
    for a in board.members[cn]:
        for tid in ctx.teachers_of(a):
            have = sorted(p for dd, p in board.teacher[tid] if dd == d)
            if not have:
                cost += 2
                continue
            if start + length - 1 < have[0]:
                cost += (have[0] - (start + length - 1) - 1) * 3
            elif start > have[-1]:
                cost += (start - have[-1] - 1) * 3
    cost += rnd.random()
    return cost


def _place_variant(ctx, board, cn, blocks, rnd):
    days_used = set()
    spread = len(blocks) <= len(ctx.days)
    placed = []
    for length in blocks:
        options = []
        for d in ctx.days:
            for start in ctx.valid_starts(length, ctx.by_id[cn]['classroom_id'], span_lunch=bool(ctx.by_id[cn].get('vocational'))):
                if board.can_place(cn, d, start, length, days_used if spread else None):
                    options.append((d, start))
        if not options:
            for d, start, length0 in placed:
                board.remove(cn, d, start, length0)
            return False
        options.sort(key=lambda it: _cheap(ctx, board, cn, it[0], it[1], length, rnd))
        d, start = options[0]
        board.place(cn, d, start, length)
        placed.append((d, start, length))
        if spread:
            days_used.add(d)
    return True


def construct(ctx, seconds, rnd, should_stop=None):
    hard = _hard_maps(ctx)
    members = _members(ctx)
    canons = list(members)
    deadline = time.time() + seconds
    best = None
    best_pen = None
    note = 'Yerleştirilemedi'
    successes = 0
    while time.time() < deadline and (not should_stop or not should_stop()):
        noise = {cn: rnd.random() for cn in canons}
        canons.sort(key=lambda cn: (-int(members[cn][0]['hours']), -len(ctx.teachers_of(members[cn][0])), noise[cn]))
        board = Board(ctx, hard)
        failed = None
        for cn in canons:
            variants = ctx.block_variants(ctx.by_id[cn])
            rest = variants[1:]
            rnd.shuffle(rest)
            variants = variants[:1] + rest
            ok = False
            for changes, blocks in variants:
                trial = board.copy()
                if _place_variant(ctx, trial, cn, blocks, rnd):
                    board = trial
                    board.changes[cn] = changes
                    ok = True
                    break
            if not ok:
                failed = ctx.label_assignment(members[cn][0])
                break
        if failed:
            note = f'{failed} için uygun saat kalmadı'
            continue
        quality = penalty_of(ctx, board.cells, board.changes)
        if not quality['ok']:
            note = quality['note'] or note
            continue
        successes += 1
        if best_pen is None or quality['penalty'] < best_pen:
            best = board
            best_pen = quality['penalty']
        if best_pen == 0 or successes >= 4:
            break
    return best, note


def _block_list(cells):
    return _runs(cells)


def improve(ctx, board, seconds, rnd, should_stop=None):
    deadline = time.time() + max(1.0, seconds)
    current = penalty_of(ctx, board.cells, board.changes)
    if not current['ok']:
        return board, current
    while time.time() < deadline and (not should_stop or not should_stop()):
        canons = [cn for cn, cells in board.cells.items() if cells]
        if not canons:
            break
        cn = rnd.choice(canons)
        runs = _block_list(board.cells[cn])
        if not runs:
            break
        d, start, length = rnd.choice(runs)
        spread = len(runs) <= len(ctx.days)
        board.remove(cn, d, start, length)
        days_used = {od for od, _, _ in runs if od != d} if spread else None
        options = []
        for nd in ctx.days:
            for ns in ctx.valid_starts(length, ctx.by_id[cn]['classroom_id'], span_lunch=bool(ctx.by_id[cn].get('vocational'))):
                if (nd, ns) == (d, start):
                    continue
                if days_used is not None and nd in days_used:
                    continue
                if board.can_place(cn, nd, ns, length, days_used):
                    options.append((nd, ns))
        rnd.shuffle(options)
        moved = False
        for nd, ns in options[:25]:
            board.place(cn, nd, ns, length)
            quality = penalty_of(ctx, board.cells, board.changes)
            if quality['ok'] and quality['penalty'] < current['penalty']:
                current = quality
                moved = True
                break
            board.remove(cn, nd, ns, length)
        if not moved:
            board.place(cn, d, start, length)
        if current['penalty'] == 0:
            break
    return board, current


def _row(algorithm, label, ok, penalty, gaps, seconds, note):
    return {
        'algorithm': algorithm,
        'label': label,
        'ok': ok,
        'penalty': penalty,
        'gaps': gaps,
        'seconds': round(seconds, 1),
        'delta': None,
        'winner': False,
        'note': note,
    }


def comparison_note(rows):
    if len(rows) < 2:
        return None
    ok = [r for r in rows if r['ok']]
    if not ok:
        return 'Seçilen algoritmaların hiçbiri program çıkaramadı.'
    winner = next(r for r in rows if r.get('winner'))
    bits = [f"En iyi: {winner['label']} (ceza {winner['penalty']}, pencere {winner['gaps']})"]
    for r in rows:
        if r['algorithm'] == winner['algorithm']:
            continue
        if not r['ok']:
            bits.append(f"{r['label']} program çıkaramadı ({r['note'] or 'yer kalmadı'})")
            continue
        if not r['delta']:
            bits.append(f"{r['label']} aynı ceza {r['penalty']}, pencere {r['gaps']}")
            continue
        bits.append(
            f"{r['label']} ceza {r['penalty']} ({r['delta']} puan daha yüksek, pencere {r['gaps']})"
        )
    return '. '.join(bits) + '.'


def finish_comparison(rows):
    ok = [r for r in rows if r['ok'] and r['penalty'] is not None]
    rank = {'cpsat': 0, 'local': 1, 'greedy': 2}
    winner = min(ok, key=lambda r: (r['penalty'], rank.get(r['algorithm'], 9))) if ok else None
    for r in rows:
        r['winner'] = bool(winner and r['algorithm'] == winner['algorithm'])
        r['delta'] = (r['penalty'] - winner['penalty']) if winner and r['ok'] and r['penalty'] is not None else None
    return winner


def run_heuristics(ctx, algorithms, should_stop=None, on_progress=None, greedy_seconds=8, local_seconds=12):
    """greedy ve/veya local çalıştırır. (en iyi ders listesi | None, satırlar)"""
    rows = []
    labels = dict(ALGORITHMS)
    reason = _unsupported(ctx)
    if reason:
        for name in algorithms:
            if name == 'cpsat':
                continue
            rows.append(_row(name, labels[name], False, None, None, 0, reason))
        return None, rows

    rnd = random.Random(ctx.data.get('seed') or 1)
    t0 = time.time()
    if on_progress:
        on_progress({'strategy': 'greedy', 'strategy_label': labels['greedy'],
                     'message': 'Sıkışık dersler yerleştiriliyor', 'elapsed': 0, 'solutions': 0})
    board, note = construct(ctx, greedy_seconds, rnd, should_stop)
    greedy_time = time.time() - t0
    if board is None:
        if 'greedy' in algorithms:
            rows.append(_row('greedy', labels['greedy'], False, None, None, greedy_time, note))
        if 'local' in algorithms:
            rows.append(_row('local', labels['local'], False, None, None, 0, 'Önce bir yerleşim gerekir'))
        return None, rows

    greedy_quality = penalty_of(ctx, board.cells, board.changes)
    greedy_lessons = lessons_of(ctx, board.cells)
    if 'greedy' in algorithms:
        rows.append(_row('greedy', labels['greedy'], True, greedy_quality['penalty'], greedy_quality['gaps'],
                         greedy_time, None))

    best_lessons = greedy_lessons if 'greedy' in algorithms else None
    best_name = 'greedy' if 'greedy' in algorithms else None

    if 'local' in algorithms:
        if on_progress:
            on_progress({'strategy': 'local', 'strategy_label': labels['local'],
                         'message': 'Pencereler yerel aramayla azaltılıyor', 'elapsed': round(greedy_time, 1),
                         'solutions': 1})
        t1 = time.time()
        improved, quality = improve(ctx, board.copy(), local_seconds, rnd, should_stop)
        local_time = time.time() - t1
        if quality['ok']:
            lessons = lessons_of(ctx, improved.cells)
            rows.append(_row('local', labels['local'], True, quality['penalty'], quality['gaps'], local_time, None))
            best_lessons = lessons
            best_name = 'local'
        else:
            rows.append(_row('local', labels['local'], False, None, None, local_time, quality.get('note')))
            if best_lessons is None:
                best_lessons = greedy_lessons
                best_name = 'greedy'
    return (best_lessons, best_name), rows
