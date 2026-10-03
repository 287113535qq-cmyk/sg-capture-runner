"""A valid owner can hold the lock longer than Windows LK_LOCK's retry limit."""
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from store import file_lock


@unittest.skipUnless(os.name == 'nt', 'Windows contention regression')
class FileLockTests(unittest.TestCase):
    def test_waiter_survives_ten_second_contention_and_enters_only_after_release(self):
        with tempfile.TemporaryDirectory() as root:
            lock = Path(root) / 'shared.lock'
            acquired = Path(root) / 'acquired'
            waiting = Path(root) / 'waiting'
            code = ('from pathlib import Path; import sys; from store import file_lock\n'
                    'Path(sys.argv[3]).touch()\n'
                    'with file_lock(Path(sys.argv[1])):\n'
                    '    Path(sys.argv[2]).touch()\n')
            child = None
            try:
                with file_lock(lock):
                    child = subprocess.Popen([sys.executable, '-c', code, str(lock), str(acquired), str(waiting)],
                        cwd=str(Path(__file__).resolve().parents[1]), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    deadline = time.monotonic() + 5
                    while not waiting.exists() and time.monotonic() < deadline:
                        time.sleep(0.01)
                    self.assertTrue(waiting.exists())
                    time.sleep(11)
                    self.assertIsNone(child.poll(), 'waiter must remain alive during contention')
                    self.assertFalse(acquired.exists(), 'waiter entered before release')
                _, error = child.communicate(timeout=5)
                self.assertEqual(child.returncode, 0, error.decode())
                self.assertTrue(acquired.exists())
            finally:
                if child is not None and child.poll() is None:
                    child.kill()
                    child.communicate()
