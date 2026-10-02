"""Fixed offline checks with bounded independent groups and measured costs.

AG reference: fixed task inventory, independent workers, bounded deadlines,
durable results, and all completed claims reviewed before a successful exit.
No source, database, workflow dispatch, or authorization is implemented here.
"""
import argparse,concurrent.futures,glob,hashlib,json,os,pathlib,signal,subprocess,sys,tempfile,time

ROOT=pathlib.Path(__file__).resolve().parents[1]

def save_result(path,result):
    """Publish each completed round atomically; an interrupted comparison is incomplete."""
    path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix('.tmp')
    with temporary.open('w',encoding='utf-8') as stream:
        json.dump(result,stream);stream.flush();os.fsync(stream.fileno())
    os.replace(temporary,path)

def compare_results(runs):
    """A reversed pair must independently improve with the same complete inventory."""
    if len(runs)!=4 or [r.get('workers') for r in runs]!=[1,2,2,1]:
        return {'accepted':False,'reason':'COMPARISON_INCOMPLETE'}
    expected={name:len(commands) for name,commands in tasks()}
    for run in runs:
        groups=run.get('groups',[])
        if not run.get('passed') or len(groups)!=len(expected) or {g['group'] for g in groups}!=set(expected):
            return {'accepted':False,'reason':'COMPARISON_CHECKS_FAILED'}
        for group in groups:
            if not group.get('passed') or len(group['commands'])!=expected[group['group']] or any(c['exitCode'] for c in group['commands']):
                return {'accepted':False,'reason':'COMPARISON_CHECKS_FAILED'}
    # Bind command inventories as well as group names; a shorter list is not speedup.
    inventories=[{g['group']:[c['argvHash'] for c in g['commands']] for g in r['groups']} for r in runs]
    if any(i!=inventories[0] for i in inventories[1:]):
        return {'accepted':False,'reason':'COMPARISON_INVENTORY_CHANGED'}
    times=[r['elapsedSeconds'] for r in runs]
    if any(not isinstance(t,(int,float)) or not 0<t<900 for t in times):
        return {'accepted':False,'reason':'COMPARISON_COST_INVALID'}
    gains=[100*(times[0]-times[1])/times[0],100*(times[3]-times[2])/times[3]]
    return {'accepted':all(g>0 for g in gains),'reason':'BOTH_PAIRS_IMPROVED' if all(g>0 for g in gains) else 'NO_REPEATABLE_GAIN',
            'pairedReductionPercent':gains,'serialSeconds':[times[0],times[3]],'parallelSeconds':[times[1],times[2]],
            'captureThroughputVerified':False}

def tasks(root=ROOT):
    def node(pattern):
        files=sorted(glob.glob(str(root/pattern)));assert files,'PREFLIGHT_TEST_SET_EMPTY'
        return ['node','--test',*files]
    scripts=['test_analyze_capture_timing.py','test_feature_reuse_index.py','test_validate_preflight_runtime.py',
             'test_analyze_performance_logs.py','test_client_method_reuse.py','test_review_gateway_document_cost.py',
             'test_run_offline_preflight.py']
    return [
      ('python',[(root,[sys.executable,'-m','unittest','discover','-s','service/tests','-q']),
                 *[(root,[sys.executable,'-m','unittest','discover','-s','scripts','-p',p,'-q']) for p in scripts]]),
      ('collector-protocol',[(root/'collector',['npm','run','typecheck']),(root/'collector',['npm','test']),
                             (root,node('scripts/trial/*.test.mjs'))]),
      ('runner-persistence',[(root,node('scripts/runner-v2/*.test.mjs')),
                             (root,['node','scripts/trial/pool-e2e-fixture.mjs'])])]

def run_group(task,deadline=300):
    name,commands=task;started=time.monotonic();results=[]
    for cwd,argv in commands:
        stamp=time.monotonic()
        with tempfile.TemporaryFile() as output:
            proc=subprocess.Popen(argv,cwd=cwd,stdout=output,stderr=subprocess.STDOUT,
                start_new_session=os.name=='posix',creationflags=0 if os.name=='posix' else subprocess.CREATE_NO_WINDOW)
            try:code=proc.wait(timeout=max(.01,deadline-(time.monotonic()-started)))
            except subprocess.TimeoutExpired:
                if os.name=='posix':os.killpg(proc.pid,signal.SIGKILL)
                else:proc.kill()
                proc.wait();code=124
            output.seek(0);log=output.read().decode('utf-8',errors='replace')
        results.append({'argvHash':hashlib.sha256(json.dumps(argv).encode()).hexdigest(),
                        'exitCode':code,'elapsedSeconds':time.monotonic()-stamp,'log':log})
        if code:break
    return {'group':name,'passed':len(results)==len(commands) and all(r['exitCode']==0 for r in results),
            'expectedCommands':len(commands),'elapsedSeconds':time.monotonic()-started,'commands':results}

def run_checks(inventory,workers):
    assert workers in (1,2,3) and len({name for name,_ in inventory})==len(inventory)
    started=time.monotonic();results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        pending={pool.submit(run_group,task):task[0] for task in inventory}
        while pending:
            done,_=concurrent.futures.wait(pending,timeout=10,return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                name=pending.pop(future);result=future.result();results.append(result)
                print('::group::'+name,flush=True)
                for command in result['commands']:print(command['log'],flush=True)
                print('::endgroup::',flush=True)
            if pending:print(json.dumps({'schema':'sg-offline-preflight-progress-v1','workers':workers,
                'remainingGroups':sorted(pending.values()),'elapsedSeconds':time.monotonic()-started}),flush=True)
    return {'workers':workers,'elapsedSeconds':time.monotonic()-started,'passed':all(r['passed'] for r in results),
            'groups':sorted(results,key=lambda r:r['group'])}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,choices=(1,2,3),default=2)
    parser.add_argument('--compare',action='store_true');args=parser.parse_args()
    assert os.name=='posix','FIXED_PREFLIGHT_REQUIRES_LINUX'
    inventory=tasks();out={'schema':'sg-offline-preflight-v1','cpuCount':os.cpu_count(),'sourceRequests':0,'mongoWrites':0}
    path=ROOT/'.local'/'offline-preflight-result.json'
    out.update(runs=[],passed=False,complete=False)
    save_result(path,out)
    if args.compare:
        # Reverse order in the second pair: first-run caches cannot by
        # themselves justify enabling concurrent checks.
        out['pairedComparison']=True
        for workers in (1,2,2,1):
            out['runs'].append(run_checks(inventory,workers));save_result(path,out)
        out['comparison']=compare_results(out['runs'])
    else:out['runs']=[run_checks(inventory,args.workers)]
    out['passed']=all(r['passed'] for r in out['runs'])
    out['complete']=True;save_result(path,out)
    summary={**out,'runs':[{**r,'groups':[{**g,'commands':[{k:v for k,v in c.items() if k!='log'}
        for c in g['commands']]} for g in r['groups']]} for r in out['runs']]}
    print(json.dumps(summary),flush=True);return 0 if out['passed'] else 1

if __name__=='__main__':sys.exit(main())
