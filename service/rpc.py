#!/usr/bin/env python3
"""Forced-command entrypoint. stdin is one bounded JSON request; no shell commands."""
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from store import Store, Rejected, InjectedCrash
from mongo_bridge import MongoBridge

def main():
    if os.environ.get('SSH_ORIGINAL_COMMAND', ''):
        raise Rejected('SHELL_COMMAND_FORBIDDEN')
    content = sys.stdin.buffer.read(16385)
    if len(content) > 16384:
        raise Rejected('REQUEST_TOO_LARGE')
    request = json.loads(content)
    result = Store('/var/lib/sg-capture-runner', MongoBridge()).dispatch(request)
    print(json.dumps(result, separators=(',', ':')))

if __name__ == '__main__':
    try:
        main()
    except InjectedCrash:
        os._exit(91)  # Real process termination after a requested fixture-only crash point.
    except Rejected as exc:
        print(json.dumps({'ok':False,'error':str(exc),'fixtureOnly':True}))
        sys.exit(2)
    except BaseException:
        print(json.dumps({'ok':False,'error':'INTERNAL_FAILURE','fixtureOnly':True}))
        sys.exit(3)
