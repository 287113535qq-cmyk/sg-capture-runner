/** The user explicitly paused collection. No environment flag can enable it. */
export function refuseCapture(): void {
  throw new Error('SG_PREPARATION_ONLY: collection is disabled pending user instruction and durability validation');
}
