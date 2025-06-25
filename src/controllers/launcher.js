// noinspection JSUnusedGlobalSymbols
const path = require("path");
const {exec} = require("child_process");
const {grabPath, getOperatingSystem} = require("../tools/compatibility.js");
const {getAssets} = require("./assets.js");
const {checkJVM} = require("./jvm.js");
const {getLibraries} = require("./libraries.js");
const {getManifests} = require("./manifest.js");
const {cauldronLogger, attachLoggerSession} = require("../tools/logger.js");
const {
    buildJVMRules,
    buildGameRules,
    buildFile,
    logInjector,
} = require("../tools/launchBuilder.js");
const ora = require('ora-classic');
const Promise = require("bluebird"); // Note: If using global Promise, you might not need this line
const {postProcessing} = require("../tools/postProcessors/forge.js");

function createUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),);
}


async function handleGrabDeps(manifests, multibar) {
    const dependencyPromises = [];
    let librariesOutput;
    cauldronLogger.info("Downloading Assets and Libraries")
    if (!manifests.jvmDownloaded) {
        dependencyPromises.push(checkJVM(manifests.jvmComp, manifests.jvmMani, multibar));
    }

    if (!manifests.assetsDownloaded) {
        cauldronLogger.debug(`Index No: ${manifests.spec.assets}`);
        cauldronLogger.debug(`Index URL: ${manifests.spec.assetIndex.url}`);
        dependencyPromises.push(getAssets(manifests.spec.assets, manifests.assetsInfo, multibar));
    }

    const librariesPromise = getLibraries(manifests.spec.libraries, manifests.versionData, manifests.spec.id, undefined);
    dependencyPromises.push(librariesPromise);

    try {
        const results = await Promise.all(dependencyPromises);
        let resultIndex = 0;
        if (!manifests.jvmDownloaded) {
            resultIndex++;
        }
        if (!manifests.assetsDownloaded) {
            resultIndex++;
        }
        librariesOutput = results[resultIndex];
        return librariesOutput; // Return the output of getLibraries
    } catch (error) {
        console.error("Error during dependency processing:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


async function launchGame(version, installOnly, loader, lVersion, authData, overrides) {
    if (!installOnly) {
        installOnly = false;
    }
    if (!overrides) {
        overrides = {jvm: {}, game: {}, additG: {}};
    }
    if (!loader) {
        loader = "vanilla";
    }
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        const spinner = ora('Starting Boot')
        try {
            let verifiedLoaders = ["vanilla", "forge", "fabric"]
            const loaderAccepted = verifiedLoaders.includes(loader);
            if (!loaderAccepted) {
                reject('Loader Not Supported! Code: LSUPNF')
                return;
            }
            getOperatingSystem();
            let sessionID = createUUID()
            cauldronLogger.debug("Session ID: " + sessionID);
            //Create Bulk Manifests
            const manifests = await getManifests(version, loader, lVersion);
            let libGet = await handleGrabDeps(manifests);

            if (loader !== "vanilla") {
                if (manifests.needsPost) {
                    libGet = await postProcessing(manifests, libGet);
                }
            }
            if (!installOnly) {
                if (manifests.spec.logging) {
                    await logInjector(path.join(CAULDRON_PATH, "assets", "log_configs", manifests.spec.logging.client.file.id,), sessionID);
                }
                let validRules = await buildJVMRules(manifests.spec, libGet, manifests.versionData, overrides.jvm);

                let gameRules = await buildGameRules(manifests.spec, authData, overrides.game, overrides.additG);
                let launchPath = await buildFile(manifests.spec, manifests.jvmComp, validRules, gameRules);
                attachLoggerSession(sessionID);
                let launchDirectory = `${CAULDRON_PATH}`;
                if (overrides["game"]) {
                    if (overrides["game"]["game_directory"]) {
                        launchDirectory = `${overrides["game"]["game_directory"]}`;
                    }
                }
                exec(`cd ${launchDirectory} && ${launchPath}`);
                resolve(sessionID);
            } else {
                resolve(true);
            }
        } catch (err) {
            spinner.fail(err.message)
            reject(err.message);
        }
    });
}

module.exports = {launchGame};
