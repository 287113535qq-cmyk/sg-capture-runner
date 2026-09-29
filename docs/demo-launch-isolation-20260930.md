# Demo pilot launch isolation

The previous rollover run 36612306276 remained queued with no jobs. Both normal and force cancellation returned HTTP409. It has not been cancelled. A separate offline preflight, 36620907099, started four seconds after creation and succeeded in the same repository. This rules out a blanket inability to start a hosted runner; it does not establish GitHub's internal queue cause.

The replacement uses one independent, source-free maintenance job. It authenticates its own running workflow and the exact old run with zero jobs and no generation writes, preserves the campaign, and adds a compare-and-swap revocation marker. While maintenance runs, the old runtime rejects the other active run; afterward its frozen snapshot no longer matches. Late jobs, partial writes, changed identity, or conflicting state stop the replacement. Existing profiles remain frozen.

The same job then activates the already tested demo generation rollover, preserving Demon446 and Beaver38 complete records. Capture remains in trial-300k.yml; only the explicitly bounded demo pilot uses a separate stable concurrency group. Admission still requires the completed generation, matching runtime and single run, and allows at most five new rounds per worker across twenty workers. Changing concurrency does not authorize additional captures.

Local verification: 464 Runner tests, 250 Python tests, 57 protocol tests, and actionlint passed. The new maintenance and source pilot have not yet run. Real results will replace this preparation status. No source request or database mutation was made by local verification.
