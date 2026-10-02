# AG action-channel canary entry

The corrected Pyramids executable now uses a separate runtime receipt while the applied action profile, activation, target and original records stay immutable. Compact reads and versioned delta writes require the original activation plus the corrected runtime receipt. A changed executable or environment flag cannot enable either path alone.

The canary admits one source run per revision and one atomic worker claim per slot 20–39. Each worker can allocate at most one existing ledger batch of at most 100 paid rounds. All workers share the permit's five-minute deadline; normal in-flight continuations still drain through durable response persistence and full Mongo readback. No additional quota is created. The parent worker stops after its child exits instead of restarting another session.

Windows verification: 1,434 Runner tests passed with the configured Python interpreter and test concurrency two. The actual retained 321-batch baseline passed the runtime amendment and run admission in memory, preserving all original documents and the 16,913 complete count. Pages were at most 100. A second source-run admission was rejected. These are offline results; they do not prove live canary throughput.

The independent revision `count-runtime-pyramids-action-canary-20261002.json` was applied by zero-source maintenance 36971477790:1 after Linux verification 36971269493. The applied revision is immutable.

Actual source run 36971754734:1 succeeded on commit 31e824f089031bddc6374755a1d8d4763b64a7bc. Twenty workers completed one batch each: 2,000 new complete rounds, bringing the retained count to 18,913. Every new Mongo document matched its durable receipt, and independent Python full verification passed. Pending rounds and reserved quota were zero. Audit requests to the game source were zero.

Independent analysis run 36972149872:1 succeeded while capture was finishing. All 100 selected annotations were read back, classified, bound to the original content/raw hashes and carried sourceAllowance zero. The 100 original records stayed byte-for-byte equivalent as documents. The remaining 1,900 new records still have durable pending classification; classification is independent of capture completion.

Final telemetry contained 20 worker reports, zero source errors and no pause transition after readiness. Individual 100-round capture segments lasted 8.38–64.47 seconds. Six workers finished before another ten-second resource sample, so their after-ready peak values are null. These values have not been replaced with zero. The reports do not prove a full five-minute resource window or a controlled before/after throughput comparison.

Private incremental evidence was verified at both locations: `ag-action-canary-final-20261002`, 25 files, 2,286,627 archive bytes, SHA256 `6c88553351901dc3d1df3e31ba0531d87f74d176ad850864ca5be998fc6274dc`. It includes only the new 2,000 full records and references the prior archive for the old 16,913.

The successor continuous runtime has since been applied, and source run 36973608232:1 is in progress. See [actual continuous entry](ag-action-continuous-entry-20261002.md). Full resource-window validation, controlled concurrency comparison and actual cross-game relay remain incomplete. All efficiency optimizations are not yet complete.
