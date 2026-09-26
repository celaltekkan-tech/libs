"""Ders programı çözücü servisi (yalnızca iç ağdan erişilir).

POST   /check        Ön kontrol (senkron)
POST   /jobs         Çözüm işini kuyruğa alır -> {job_id}
GET    /jobs/{id}    Durum, ilerleme ve sonuç
DELETE /jobs/{id}    İptal
GET    /health
"""

import os
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Request

import timetable_model

MAX_JOBS = int(os.environ.get('SOLVER_MAX_JOBS', '1'))
DEFAULT_WORKERS = int(os.environ.get('SOLVER_WORKERS', '4'))
MAX_TIME_LIMIT = int(os.environ.get('SOLVER_MAX_TIME_LIMIT', '600'))
JOB_TTL_SECONDS = 3600

app = FastAPI(title='OIDS Timetable Solver')
executor = ThreadPoolExecutor(max_workers=MAX_JOBS)
jobs = {}
lock = threading.Lock()


def _cleanup():
    now = time.time()
    with lock:
        for jid in [j for j, v in jobs.items() if v.get('finished_at') and now - v['finished_at'] > JOB_TTL_SECONDS]:
            jobs.pop(jid, None)


def _run(job_id, data):
    job = jobs[job_id]
    if job['cancel']:
        job.update(status='cancelled', finished_at=time.time())
        return
    job.update(status='running', started_at=time.time())

    def on_progress(p):
        job['progress'] = p

    try:
        result = timetable_model.solve(data, on_progress=on_progress, should_stop=lambda: job['cancel'])
        job['result'] = result
        job['status'] = 'cancelled' if job['cancel'] and not result.get('lessons') else 'done'
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        job.update(status='failed', error=str(exc))
    job['finished_at'] = time.time()


@app.get('/health')
def health():
    running = sum(1 for j in jobs.values() if j['status'] == 'running')
    queued = sum(1 for j in jobs.values() if j['status'] == 'queued')
    return {'ok': True, 'running': running, 'queued': queued, 'max_jobs': MAX_JOBS}


@app.post('/check')
async def check(request: Request):
    data = await request.json()
    return timetable_model.check(data)


@app.post('/jobs')
async def create_job(request: Request):
    _cleanup()
    data = await request.json()
    data['time_limit'] = max(5, min(int(data.get('time_limit') or 60), MAX_TIME_LIMIT))
    data.setdefault('workers', DEFAULT_WORKERS)
    job_id = uuid.uuid4().hex
    with lock:
        jobs[job_id] = {'status': 'queued', 'cancel': False, 'progress': None, 'result': None,
                        'error': None, 'created_at': time.time(), 'finished_at': None}
    executor.submit(_run, job_id, data)
    return {'job_id': job_id}


@app.get('/jobs/{job_id}')
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    return {k: job[k] for k in ('status', 'progress', 'result', 'error')}


@app.delete('/jobs/{job_id}')
def cancel_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    job['cancel'] = True
    return {'ok': True}
