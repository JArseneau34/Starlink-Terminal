import { updateAndPublishWalkerFit } from '../server/walkerFit/orchestrator.ts';

async function main() {
  const payload = await updateAndPublishWalkerFit();
  const assigned = payload.shells.reduce((s, sh) => s + sh.occupancy.assigned, 0);
  console.log(
    `Walker fit published — ${assigned} assignments across ${payload.shells.length} granted shells (${payload.transitCount} transit excluded, ${payload.walkerReferenceTotal.toLocaleString()} McDowell working, ${payload.grantedSlotTotal.toLocaleString()} FCC slots)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
