# Continuous action-channel entry

The Pyramids action canary completed 2,000 new rounds, including 18 natural continuation chains and 274 FREE_GAME responses. The longest complete chain had 39 frames. Full Mongo/receipt equality and independent Python verification passed. These are actual flow results; they do not establish complete gameplay coverage.

The successor executable is commit `9aafef9ac94300c02ce74bb83db7eb97dfcef00d`. Linux preflight `36973213007:1` succeeded. Zero-source refresh `36973418231:1` succeeded and its runtime receipt was read back. The applied independent revision is `count-runtime-pyramids-action-continuous-20261002.json`, canonical hash `c24171b25372612a54038a48121fdc4b1af9f16095d625320d22f1d38bd19a80`. It binds the successful canary, all 341 settled batches, the original activation and original target. It preserved 18,913 complete rounds and 280,937 remaining rounds without creating quota or changing old records. The applied revision must stay immutable.

Source run `36973608232:1` is a single 15-minute controlled continuous run with twenty hosts and one lane per host. Its worker deadline comes from the immutable admission permit rather than restarting a fresh duration for each child. Normal pending continuation and full readback protection remain in place. This revision does not authorize automatic relay or additional concurrent lanes.

At native snapshot `1790922668`, the pool was enabled without failure: 25,813 confirmed rounds, 6,900 more than the canary baseline, nineteen active batches and 1,900 reserved rounds. This is an in-progress count, not the final independent full audit. An independent one-second diagnostic at `1790922665` measured server CPU 55.12%, memory 61.65% and 129.56 GiB free disk. It does not prove a full resource window.

Independent analysis `36973693123:1` succeeded while continuous capture was running. The next 100 annotations were read back as classified, bound to their original hashes and sourceAllowance zero; the original documents stayed unchanged. Together with the earlier canary analysis, 200 of the original 2,000 action records have independently read-back annotations. Remaining classification does not block complete-flow capture.

The new admission and compact/delta bindings passed 71 targeted tests plus the workflow-choice check. Both workflow files parsed, and the actual 341-batch refresh/admission replay used pages of at most 100 and changed no existing documents. These offline checks supplement the actual preflight and maintenance evidence.

Private preparation archive `ag-action-continuous-prepare-20261002` contains 17 files, 102,268 bytes, SHA256 `e188605f2e38f21213bb54fe45739f3c34b1fc4c688dda7ec1cccb9126ee3c21`. Applied-entry archive `ag-action-continuous-entry-20261002` contains 15 files, 351,295 bytes, SHA256 `00c00deab70a82e5734def266ebd240439700653f54479105c8d59cf0088c0e1`. Both locations verified file bytes and hashes; old raw records are referenced, not exported again.

Full resource-window acceptance, matched controlled concurrency throughput comparison, final audit of this running source and actual cross-game automatic relay are still outstanding. No claim of all efficiency optimizations complete is made. The first-round completed-game count remains 16/178.
