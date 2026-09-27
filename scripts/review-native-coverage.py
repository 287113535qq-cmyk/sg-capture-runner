"""Read-only entry point for the ordinary-game protocol coverage review."""
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'service'))
from native_coverage import main

if __name__=='__main__':main()
