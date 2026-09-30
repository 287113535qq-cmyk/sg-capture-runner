"""Offline timing summary. Reads private records; emits only numeric aggregates.

No network, database access, raw payload output, or capture authorization.
"""
import argparse
import json
import math
from pathlib import Path


def summarize(document):
    records = document["records"]
    if not isinstance(records, list) or not records:
        raise ValueError("TIMING_RECORDS_REQUIRED")
    durations = []
    for record in records:
        steps = record["raw"]["steps"]
        if not isinstance(steps, list) or not steps:
            raise ValueError("TIMING_STEPS_REQUIRED")
        for step in steps:
            value = step["elapsedMs"]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError("INVALID_ELAPSED_MS")
            durations.append(value)
    ordered = sorted(durations)
    total = sum(durations)
    def quantile(p):
        return ordered[max(0, math.ceil(p * len(ordered)) - 1)]
    return {
        "schema": "sg-offline-source-timing-v1", "records": len(records),
        "frames": len(durations), "framesPerRound": len(durations) / len(records),
        "sourceTotalMs": total, "sourceMeanMs": total / len(durations),
        "sourceMsPerRound": total / len(records), "p50Ms": quantile(.5),
        "p95Ms": quantile(.95), "p99Ms": quantile(.99), "maxMs": max(durations),
        "thresholds": [{"atLeastMs": threshold,
            "frames": sum(x >= threshold for x in durations),
            "timeShare": sum(x for x in durations if x >= threshold) / total if total else None}
            for threshold in (1000, 4000, 8000)],
        "sourceRequests": 0, "captureAuthorization": False,
        "limitation": "Sample only; elapsed time cannot distinguish network from remote processing."
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = summarize(json.loads(args.input.read_text(encoding="utf-8")))
    text = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        if args.output.resolve() == args.input.resolve():
            raise ValueError("DO_NOT_OVERWRITE_PRIVATE_INPUT")
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
