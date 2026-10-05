"""Inspect bounded successful closed Linux logs. No network or database access."""
import io,json,sys,zipfile
raw=sys.stdin.buffer.read(32*1024*1024+1)
assert 0<len(raw)<=32*1024*1024,'BUSINESS_LINUX_ARCHIVE_SIZE'
archive=zipfile.ZipFile(io.BytesIO(raw));entries=archive.infolist()
assert len(entries)<=1000 and sum(e.file_size for e in entries)<=128*1024*1024,'BUSINESS_LINUX_UNPACK_SIZE'
results=[]
for entry in entries:
    if 'Fixed offline checks' not in entry.filename:continue
    for line in archive.read(entry).decode('utf-8',errors='strict').splitlines():
        at=line.find('{"schema": "sg-offline-preflight-v1"')
        if at>=0:results.append(json.loads(line[at:]))
assert len(results)==1,'BUSINESS_LINUX_FULL_JOINED_RESULT_REQUIRED'
print(json.dumps(results[0]))
