import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles, lncli, pollUntil, ROOT } from "../../../infra/lnbits/lab-common.mjs";

export const LAB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = labFiles(LAB_DIR);
export const { readEnv, setEnv, saveState, loadState, stateDir: STATE_DIR } = files;
export { lncli, pollUntil, ROOT };

// Each connection is saved in .env under its own key. The default name, alby-lab1,
// uses NWC_CONNECTION_STRING, which the check reads.
export const DEFAULT_NAME = "alby-lab1";
export function validName(name) {
  return /^[A-Za-z0-9_-]{1,40}$/.test(name);
}
export function connectionKey(name) {
  return name === DEFAULT_NAME ? "NWC_CONNECTION_STRING" : `NWC_CONNECTION_STRING_${name.toUpperCase().replace(/-/g, "_")}`;
}
