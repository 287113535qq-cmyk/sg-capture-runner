import json
import unittest
from analyze_capture_timing import summarize


class TimingSummaryTests(unittest.TestCase):
    def sample(self, values):
        return {"records": [{"session": "PRIVATE", "raw": {"steps": [
            {"elapsedMs": value, "responsePayload": "PRIVATE"} for value in values]}}]}

    def test_tail_contribution_and_no_payload_output(self):
        result = summarize(self.sample([0, 50, 50, 4900]))
        self.assertEqual(result["sourceTotalMs"], 5000)
        self.assertEqual(result["p95Ms"], 4900)
        self.assertEqual(result["thresholds"][0]["timeShare"], .98)
        self.assertNotIn("PRIVATE", json.dumps(result))
        self.assertEqual(result["sourceRequests"], 0)

    def test_missing_invalid_and_zero_durations(self):
        for value in [True, -1, float("nan"), float("inf"), "50"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                summarize(self.sample([value]))
        with self.assertRaises(KeyError):
            summarize({"records": [{"raw": {"steps": [{}]}}]})
        self.assertIsNone(summarize(self.sample([0]))["thresholds"][0]["timeShare"])


if __name__ == "__main__":
    unittest.main()
