import sys,pathlib,json
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[3]/'service'))
from own_terminal_fields import verify_terminal
out=[]
for x in json.load(sys.stdin):
 try:out.append({'accepted':True,'value':verify_terminal(x['plan'],x['raw'])})
 except Exception as e:out.append({'accepted':False,'errorType':type(e).__name__})
print(json.dumps(out))
