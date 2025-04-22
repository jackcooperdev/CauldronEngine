import { cauldronLogger } from "../../tools/logger.js";
import { destroySession } from "../../tools/sessionManager.js";
import unsupportedVersions from "./files/blocked_versions.json" with { type: "json" };

// Grabs ForgeVersion from ForgePromo
// Attempts to find a recommended version else forces latest
// Fails if in blacklist or version does not exist
async function identifier(version, forgePromos) {
  return new Promise(async (resolve, reject) => {
    try {
      let type = "recommended";

      if (unsupportedVersions.includes(version)) {
        await destroySession();
        reject(
          `Sorry but Cauldron does not support ${version} forge yet. CODE: BLVER`,
        );
      }
      /**
       * @param forgePromos.promos
       */
      let forgeVersion = forgePromos.promos[`${version}-${type}`];
      if (!forgeVersion) {
        forgeVersion = forgePromos.promos[`${version}-latest`];
        if (!forgeVersion) {
          reject("Version Does Not Exist");
        }
      }
      cauldronLogger.info("Forge Plugin Created By @jackcooperdev");
      cauldronLogger.warn("Forge is still experimental. Expect Crashes");
      resolve(forgeVersion);
    } catch (e) {
      cauldronLogger.error(e);
    }
  });
}

export { identifier };
