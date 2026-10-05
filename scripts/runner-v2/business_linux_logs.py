"""Inspect bounded successful closed Linux logs. No network or database access."""
import io,json,re,sys,zipfile

def parse_archive(raw):
    assert 0<len(raw)<=32*1024*1024,'BUSINESS_LINUX_ARCHIVE_SIZE'
    archive=zipfile.ZipFile(io.BytesIO(raw));entries=archive.infolist()
    assert len(entries)<=1000 and sum(e.file_size for e in entries)<=128*1024*1024,'BUSINESS_LINUX_UNPACK_SIZE'
    results=[]
    for entry in entries:
        # GitHub initially returns step files alongside the aggregate job log,
        # then may return only the aggregate. Both contain the same joined JSON.
        if not ('Fixed offline checks' in entry.filename or re.fullmatch(r'[1-9][0-9]*_preflight\.txt',entry.filename)):continue
        found=[]
        for line in archive.read(entry).decode('utf-8',errors='strict').splitlines():
            at=line.find('{"schema": "sg-offline-preflight-v1"')
            if at>=0:found.append(json.loads(line[at:]))
        assert len(found)<=1,'BUSINESS_LINUX_FULL_JOINED_RESULT_REQUIRED'
        results.extend(found)
    assert results and all(value==results[0] for value in results),'BUSINESS_LINUX_FULL_JOINED_RESULT_REQUIRED'
    return results[0]

if __name__=='__main__':
    print(json.dumps(parse_archive(sys.stdin.buffer.read(32*1024*1024+1))))
