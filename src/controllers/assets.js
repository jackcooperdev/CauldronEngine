import fs from "fs";
import path from "path";
import {cauldronLogger} from "../tools/logger.js";
import {grabPath} from "../tools/compatibility.js";
import {processQueue, verifyInstallation} from "./queue.js";

async function getAssets(assetsIndex, assetFiles) {
    let CAULDRON_PATH = grabPath();
    return new Promise(async (resolve) => {

        await processQueue(assetFiles, true, 'assets');
        cauldronLogger.debug(`Checksums Passed Install is Valid!`);
        if (assetsIndex !== "pre-1.6") {
            // Mark AssetFile As Downloaded
            let currentAssetFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json")).toString());
            currentAssetFile[assetsIndex] = {
                installed: true, lastChecked: new Date().getTime(),
            };
            fs.writeFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json"), JSON.stringify(currentAssetFile));
        }
        resolve(true);
    });
}

export {getAssets};
