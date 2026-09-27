"""Install this dedicated fixture service; never deploy or modify SG game services."""
import argparse
import json
import os
import pwd
import re
import secrets
import stat
import subprocess
from pathlib import Path

DATABASE='sg_capture_staging_v1'
USERNAME='sg_capture_staging_writer_v1'

def checked(condition, message):
    if not condition:raise SystemExit(message)

def atomic(path, data, mode):
    path=Path(path)
    temporary=path.with_name(path.name+'.installing')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,mode)
    try:
        os.fchmod(fd,mode)
        with os.fdopen(fd,'wb',closefd=False) as handle:
            handle.write(data if isinstance(data,bytes) else data.encode())
            handle.flush();os.fsync(handle.fileno())
    finally:os.close(fd)
    os.replace(temporary,path)
    dfd=os.open(path.parent,os.O_DIRECTORY)
    try:os.fsync(dfd)
    finally:os.close(dfd)

def mongo_eval(script):
    proc=subprocess.run(['/usr/bin/docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',
                         "(async()=>{await eval(require('fs').readFileSync('/dev/stdin','utf8'))})()"],
                        input=script,text=True,capture_output=True,timeout=45)
    lines=[line for line in proc.stdout.splitlines() if line.startswith('SG_INSTALL=')]
    checked(proc.returncode==0 and len(lines)==1,'Mongo bootstrap failed; credential-bearing diagnostics suppressed')
    return json.loads(lines[0].split('=',1)[1])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--commit',required=True);parser.add_argument('--public-key',required=True)
    args=parser.parse_args()
    checked(os.geteuid()==0,'Root installer required')
    checked(re.fullmatch('[a-f0-9]{40}',args.commit),'Invalid commit')
    release=Path('/opt/sg-capture-runner/releases')/args.commit
    checked(release.resolve()==release and (release/'service/rpc.py').is_file(),'Invalid release directory')
    checked((release/'service/round_fields.py').is_file() and (release/'service/round_types.json').is_file(),'Business-field analyzer or mapping missing')
    public=Path(args.public_key).read_text().strip().split()
    checked(len(public) in (2,3) and public[0]=='ssh-ed25519' and re.fullmatch('[A-Za-z0-9+/=]+',public[1]),'Invalid dedicated public key')
    key=' '.join(public[:2])+' sg-capture-runner-fixture'
    config=Path('/etc/sg-capture-runner');config.mkdir(mode=0o700,exist_ok=True)
    managed=config/'managed.json'
    try:pwd.getpwnam('sgcapture');user_exists=True
    except KeyError:user_exists=False
    checked(not user_exists or (managed.is_file() and json.loads(managed.read_text()).get('service')=='sg-link-fixture-v1'),'Existing unmanaged sgcapture account; refusing takeover')
    marker={'service':'sg-link-fixture-v1','commit':args.commit,'database':DATABASE,'gamePoolsTouched':False}
    credential=config/'mongo-auth.json'
    if credential.exists():
        writer=json.loads(credential.read_text())
        checked(writer.get('database')==DATABASE and writer.get('user')==USERNAME,'Unexpected writer credential identity')
    else:
        writer={'database':DATABASE,'user':USERNAME,'password':secrets.token_urlsafe(48)}
        atomic(credential,json.dumps(writer),0o600)
    root=Path('/api/api_new/server/slots/sg-nx')
    auth=None
    for p in sorted(root.glob('sg_*/.config-cache/mongo-config-*.json')):
        records=json.loads(p.read_text());checked(isinstance(records,list) and len(records)==1,'Ambiguous effective Mongo endpoint')
        current={k.lower():v for k,v in records[0].items()}
        checked(auth is None or auth==current,'Inconsistent effective Mongo caches')
        auth=current
    checked(auth is not None,'Effective Mongo cache missing')
    script='(async()=>{const a='+json.dumps(auth)+';const w='+json.dumps(writer)+';await db.getSiblingDB(a.name).auth(String(a.user),String(a.pwd));const stage=db.getSiblingDB(w.database);'
    script+='const existing=await stage.getUser(w.user);if(existing){if(existing.roles.length!==1||existing.roles[0].role!=="readWrite"||existing.roles[0].db!==w.database)throw Error("ROLE_MISMATCH");}else{await stage.createUser({user:w.user,pwd:w.password,roles:[{role:"readWrite",db:w.database}]},{w:"majority",j:true});}print("SG_INSTALL="+JSON.stringify({created:!existing,database:w.database,scope:"readWrite-staging-only"}));})()'
    created=mongo_eval(script)
    verified=mongo_eval('(async()=>{const w='+json.dumps(writer)+';await db.getSiblingDB(w.database).auth(w.user,w.password);const roles=(await db.adminCommand({connectionStatus:1})).authInfo.authenticatedUserRoles;if(roles.length!==1||roles[0].db!==w.database||roles[0].role!=="readWrite")throw Error("ROLE_MISMATCH");print("SG_INSTALL="+JSON.stringify({restrictedWriterVerified:true}));})()')
    # Write the ownership marker before user creation, so interruption can be resumed safely.
    atomic(managed,json.dumps(marker,indent=2)+'\n',0o600)
    home=Path('/var/lib/sg-capture-access');home.mkdir(mode=0o755,exist_ok=True)
    if not user_exists:
        subprocess.run(['/usr/sbin/useradd','--system','--user-group','--no-create-home','--home-dir',str(home),'--shell','/bin/sh','sgcapture'],check=True)
    checked(pwd.getpwnam('sgcapture').pw_dir==str(home),'Unexpected dedicated user home')
    (home/'.ssh').mkdir(mode=0o755,exist_ok=True)
    os.chmod(home,0o755);os.chmod(home/'.ssh',0o755)
    auth_keys=home/'.ssh/authorized_keys'
    key_line='restrict,command="/usr/local/sbin/sg-capture-entry" '+key+'\n'
    checked(not auth_keys.exists() or auth_keys.read_text()==key_line,'Refusing to replace a different access key')
    atomic(auth_keys,key_line,0o644)
    entry='#!/bin/sh\nset -eu\nif [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then\n  echo \'{"ok":false,"error":"SHELL_COMMAND_FORBIDDEN","fixtureOnly":true}\'\n  exit 2\nfi\nexec /usr/bin/sudo -n /usr/local/sbin/sg-capture-rpc\n'
    wrapper='#!/bin/sh\nset -eu\numask 077\nexec /usr/bin/python3 -I -B /opt/sg-capture-runner/current/service/rpc.py\n'
    atomic('/usr/local/sbin/sg-capture-entry',entry,0o755)
    atomic('/usr/local/sbin/sg-capture-rpc',wrapper,0o755)
    sudoers='sgcapture ALL=(root) NOPASSWD: /usr/local/sbin/sg-capture-rpc ""\n'
    sudo_temp=Path('/etc/sudoers.d/sg-capture-runner.checking')
    atomic(sudo_temp,sudoers,0o440)
    subprocess.run(['/usr/sbin/visudo','-cf',str(sudo_temp)],check=True,stdout=subprocess.DEVNULL)
    os.replace(sudo_temp,'/etc/sudoers.d/sg-capture-runner')
    storage=Path('/var/lib/sg-capture-runner');storage.mkdir(mode=0o700,exist_ok=True);os.chmod(storage,0o700)
    current=Path('/opt/sg-capture-runner/current');candidate=current.with_name('current.installing')
    checked(not candidate.exists() and not candidate.is_symlink(),'Unfinished service activation needs inspection')
    candidate.symlink_to(release,target_is_directory=True);os.replace(candidate,current)
    print(json.dumps({'installed':True,'commit':args.commit,'storage':str(storage),'database':DATABASE,'sshUser':'sgcapture','forcedCommandOnly':True,**created,**verified,'officialSourceRequestsOnServer':False,'singleGameTrialStorageEnabled':True,'gamePoolsTouched':False}))

if __name__=='__main__':
    try:main()
    except SystemExit:raise
    except Exception:raise SystemExit('Fixture service installation failed; sensitive diagnostics suppressed')
