// noinspection JSUnusedGlobalSymbols

import path from "path";

import {exec} from "child_process";
import {grabPath, getOperatingSystem} from "../tools/compatibility.js";
import {getAssets} from "./assets.js";
import {checkJVM} from "./jvm.js";
import {getLibraries} from "./libraries.js";
import {getManifests} from "./manifest.js";
import {cauldronLogger, attachLoggerSession} from "../tools/logger.js";
import {createSession, destroySession} from "../tools/sessionManager.js";
import {
    buildJVMRules,
    buildGameRules,
    buildFile,
    logInjector,
} from "../tools/launchBuilder.js";
import {getPostPlugin} from "../plugins/plugins.js";

async function launchGame(
    version,
    installOnly,
    loader,
    lVersion,
    authData,
    sessionID,
    overrides,
) {
    if (!installOnly) {
        installOnly = false;
    }
    if (!overrides) {
        overrides = {jvm: {}, game: {}, additG: {}};
    }
    if (!loader) {
        loader = "vanilla";
    }
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        try {
            getOperatingSystem();
            //Create SessionID If Not Declared
            if (!sessionID) {
                sessionID = createSession();
            }
            cauldronLogger.debug("Session ID: " + sessionID);
            // Create Bulk Manifests
            const manifests = await getManifests(version, loader, lVersion);
            cauldronLogger.success("Manifests Got!");
            if (!manifests.jvmDownloaded) {
                cauldronLogger.start(`Getting JVM: ${manifests.jvmComp}`);
                await checkJVM(manifests.jvmComp, manifests.jvmMani);
                cauldronLogger.success("JVM Passed!");
            } else {
                cauldronLogger.success("Skipping JVM");
            }

            if (loader !== "vanilla") {
                await getPostPlugin(loader, manifests);
            }
            if (!manifests.assetsDownloaded) {
                cauldronLogger.start("Starting Asset Download");
                cauldronLogger.debug(`Index No: ${manifests.spec.assets}`);
                cauldronLogger.debug(`Index URL: ${manifests.spec.assetIndex.url}`);
                await getAssets(manifests.spec.assets, manifests.assetsInfo);
            } else {
                cauldronLogger.success("Skipping Assets");
            }
            cauldronLogger.start("Starting Library Download");
            const libGet = await getLibraries(
                manifests.spec.libraries,
                manifests.versionData,
                manifests.spec.id,
            );
            if (!installOnly) {
                cauldronLogger.success("All Files Acquired Building Launch File");
                if (manifests.spec.logging) {
                    await logInjector(
                        path.join(
                            CAULDRON_PATH,
                            "assets",
                            "log_configs",
                            manifests.spec.logging.client.file.id,
                        ),
                        sessionID,
                    );
                }
                let validRules = await buildJVMRules(
                    manifests.spec,
                    libGet,
                    manifests.versionData,
                    overrides.jvm,
                );
                cauldronLogger.success("Created JVM Arguments")
                let gameRules = await buildGameRules(
                    manifests.spec,
                    authData,
                    overrides.game,
                    overrides.additG,
                );
                let launchPath = await buildFile(
                    manifests.spec,
                    manifests.jvmComp,
                    validRules,
                    gameRules,
                );
                cauldronLogger.success("Created Game Arguments");
                attachLoggerSession(sessionID);
                let launchDirectory = `${CAULDRON_PATH}`;
                if (overrides["game"]) {
                    if (overrides["game"]["game_directory"]) {
                        launchDirectory = `${overrides["game"]["game_directory"]}`;
                    }
                }
                exec(`cd ${launchDirectory} && ${launchPath}`);
                cauldronLogger.success("Started Game")
                resolve(sessionID);
            } else {
                await destroySession(sessionID);
                cauldronLogger.success("Game Installed");
                resolve(true);
            }
        } catch (err) {
            await destroySession(sessionID);
            cauldronLogger.error(err.message);
            resolve(err.message);
        }
    });
}

export {launchGame};
