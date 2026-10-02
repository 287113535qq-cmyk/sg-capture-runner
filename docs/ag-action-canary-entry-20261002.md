# AG action-channel canary entry

The corrected Pyramids executable now uses a separate runtime receipt while the applied action profile, activation, target and original records stay immutable. Compact reads and versioned delta writes require the original activation plus the corrected runtime receipt. A changed executable or environment flag cannot enable either path alone.

The canary admits one source run per revision and one atomic worker claim per slot 20–39. Each worker can allocate at most one existing ledger batch of at most 100 paid rounds. All workers share the permit's five-minute deadline; normal in-flight continuations still drain through durable response persistence and full Mongo readback. No additional quota is created. The parent worker stops after its child exits instead of restarting another session.

Windows verification: 1,434 Runner tests passed with the configured Python interpreter and test concurrency two. The actual retained 321-batch baseline passed the runtime amendment and run admission in memory, preserving all original documents and the 16,913 complete count. Pages were at most 100. A second source-run admission was rejected. These are offline results; they do not prove live canary throughput.

The independent revision `count-runtime-pyramids-action-canary-20261002.json` is prepared, not yet applied. Linux verification, zero-source runtime amendment, actual canary, classification audit and real cross-game relay remain required. Source requests and live Mongo writes for this preparation were zero. All efficiency optimizations are not yet complete.
