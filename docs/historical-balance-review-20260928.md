# Historical balance anomalies, 2026-09-28

The eight games below each contain one historical `buy=0` record whose stored
starting balance, final balance and total win imply a negative stake. The
existing `INVALID_WAGER_BASIS` rejection is correct and remains unchanged.
These are historical evidence problems, not the cause of the current 32651 halt.

All 800 rows were read without modifying the source files. Every anomalous BET
matches exactly one successful response in the corresponding `traffic.jsonl`,
including the original request, response payload and response XML. In all eight
cases, the preceding successful frame has the same session identifier and its
`B` and `AB` agree with the recorded starting balance. This establishes a balance
discontinuity in the saved successful traffic. It does not establish its cause,
authorize a balance correction, or prove a new-session reset.

All amounts below are integer minor units. The equation is
`stake = startBalance - endBalance + totalWin`.

| Game | Round line | Traffic line | Start | End | Win | Derived stake |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 32486 Colossal Splash Ink & Win | 12 | 14 | 99980 | 100005 | 15 | -10 |
| 32530 Gold Fish Feeding Time! Treasure | 14 | 16 | 98810 | 99900 | 0 | -1090 |
| 32544 Huff N' Lots of Puff | 34 | 36 | 93730 | 99800 | 0 | -6070 |
| 32547 Huff N' Puff High Rise | 21 | 23 | 96250 | 99800 | 0 | -3550 |
| 32555 Hypercharged Temple of Atlantis | 9 | 11 | 99475 | 99900 | 0 | -425 |
| 32595 Money Raid Wapiti | 40 | 42 | 93840 | 99900 | 100 | -5960 |
| 32629 Rich Little Hens Founding Feathers | 68 | 79 | 95445 | 99900 | 0 | -4455 |
| 32686 Ultimate Fire Link Cash Falls Olvera Street | 25 | 27 | 98010 | 99900 | 0 | -1890 |

The historical stored bet is zero for each of these eight rows. Do not credit
them, invent a positive stake from the request parameters, overwrite their raw
evidence, or relax the live settlement validator. The other 792 rows reconcile
to their stored bet; 13 have continuations. That is a money check only: no new
historical credit, type mapping, full protocol approval or Mongo parity approval
has been granted by this review.

The separate native frame review inspected all saved traffic for these eight
ordinary request templates (100 matching BET starts each, no truncation).
32486, 32595 and 32686 additionally contain unsupported feature frames (22, 21
and 6 respectively). The other five have no native-frame findings in this
corpus. Absence of findings in this small corpus does not prove complete natural
feature coverage. Continue their official cached client review and independent
settlement/type/Mongo checks before any controlled queue migration. All eight
remain `needs-adapter`, with first-round targets and historical credit unchanged.

Reproduce the balance report from the capture repository:

```powershell
python scripts/review-historical-balances.py --assets E:/platform-sync/api_new/api.numeric/capture/capture-sg/assets --game-ids 32486 32530 32544 32547 32555 32595 32629 32686 --output docs/historical-balance-review-20260928.json
python -m unittest discover -s service/tests -p test_historical_balance_review.py -v
```

The native review uses `service/native_coverage.py:review` with each game's
single ordinary `requestTemplates` entry from `.local/round-one-inventory.json`,
removing `MSGID` to construct the temporary review-only `requestParams`. It
does not add those templates to any runtime plan. Full file and per-record hashes
are in the JSON reports; private payloads and session values are not exported.

Validation: seven Windows tests passed, covering negative/zero stakes, positive
bet mismatch, successful XML evidence, fractional minor units, duplicate/missing
traffic matches, session continuity and private-field exclusion. This operator
script is offline only; no collection runtime module, registry or plan changed.
No GitHub job, SG request, database write or queue mutation was made.

Live status read at the start of this review: 3 complete, 1 active, 19 ready,
155 needs-adapter; 32651 remains 233 journaled / 189 durable with 3 pending
rounds. The last GitHub preflight annotation still reports an account payment
or spending-limit restriction before runner allocation. It does not identify
which billing condition applies. The original collection remains paused.

The existing `sg-30` heartbeat name and prompt were repaired to valid Chinese;
readback found zero replacement characters. The same task, 20-minute interval,
active status and collection/notification boundaries were preserved. This does
not enable the GitHub collection workflow.
