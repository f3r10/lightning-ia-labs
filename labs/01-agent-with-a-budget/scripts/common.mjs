import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labFiles, lncli, pollUntil, ROOT } from "../../../infra/lnbits/lab-common.mjs";

export const LAB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = labFiles(LAB_DIR);
export const { readEnv, setEnv, saveState, loadState, stateDir: STATE_DIR } = files;
export { lncli, pollUntil, ROOT };
