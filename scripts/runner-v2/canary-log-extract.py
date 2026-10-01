"""Read final numeric observations once from Actions job aggregates."""
import json
import sys
import zipfile


def extract(path, expected_count=40):
    assert expected_count in (40, 80), 'UNSUPPORTED_FINAL_ROW_COUNT'
    rows = []
    names = set()
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        assert len(infos) <= 2000 and sum(info.file_size for info in infos) <= 128 * 1024**2
        for info in infos:
            assert info.filename not in names, 'DUPLICATE_ARCHIVE_MEMBER'
            names.add(info.filename)
            if info.is_dir():
                continue
            assert info.file_size <= 32 * 1024**2
            # Step logs repeat job aggregate lines. Never count both layouts.
            if '/' in info.filename or '\\' in info.filename or not info.filename.endswith('.txt'):
                continue
            for line in archive.read(info).decode('utf-8', errors='strict').splitlines():
                if '"schema":"sg-capture-performance-v1"' not in line and '"schema": "sg-capture-performance-v1"' not in line:
                    continue
                start = line.find('{')
                assert start >= 0, 'MALFORMED_PERFORMANCE_LINE'
                row = json.loads(line[start:])
                if row.get('schema') == 'sg-capture-performance-v1' and row.get('reason') == 'final':
                    rows.append(row)
    assert len(rows) == expected_count, 'MISSING_OR_DUPLICATE_FINAL_ROWS'
    return rows


if __name__ == '__main__':
    print(json.dumps(extract(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)))
