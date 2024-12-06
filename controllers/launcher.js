const path = require('path')
const {exec} = require('child_process');


const {grabPath, getOperatingSystem} = require('../tools/compatibility');
const {getAssets} = require("./assets");
const {checkJVM} = require("./jvm");
const {getLibraries} = require("./libraries");
const {getManifests} = require('./manifest')
const {cauldronLogger, setLoggerSession} = require('../tools/logger');
const {createSession, destroySession} = require("../tools/sessionManager");
const {buildJVMRules, buildGameRules, buildFile, logInjector} = require("../tools/launchBuilder");
const {getPostPlugin} = require('../plugins/plugins');


async function launchGame(version, dry, loader, lVersion, authData, sessionID, overrides) {
    if (!dry) {
        dry = false;
    }
    if (!overrides) {
        overrides = {'jvm': {}, 'game': {}, 'additG': {}};
    }
    if (!loader) {
        loader = 'vanilla';
    }
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        try {
            getOperatingSystem();
            //Create SessionID If Not Declared
            if (!sessionID) {
                let newSession = {
                    type: 'game',
                    version: version,
                    loader: loader,
                    overrides: overrides
                };
                sessionID = createSession(newSession);
            }
            cauldronLogger.info("Session ID: " + sessionID)
            //Acquire Manifests (All)
            // Finds ALL Manifests Required for version. Offline Failsafe
            const manifests = await getManifests(version, loader, lVersion);
            cauldronLogger.info("Manifests Got!")
            if (!manifests.jvmDownloaded) {
                cauldronLogger.info(`Getting JVM: ${manifests.jvmComp}`);
                await checkJVM(manifests.jvmComp, manifests.jvmMani);
                cauldronLogger.info('JVM Passed!');
            } else {
                cauldronLogger.info("Skipping JVM")
            }

            if (loader !== 'vanilla') {
                console.log('start post')
                await getPostPlugin(loader, manifests)
                console.log('end post')
            }
            if (!manifests.assetsDownloaded) {
                cauldronLogger.info('Starting Asset Download');
                cauldronLogger.info(`Index No: ${manifests.spec.assets}`);
                cauldronLogger.info(`Index URL: ${manifests.spec.assetIndex.url}`)
                await getAssets(manifests.spec.assets, manifests.assetsInfo);
            } else {
                cauldronLogger.info("Skipping Assets");
            }
            cauldronLogger.info('Starting Library Download')
            const libGet = await getLibraries(manifests.spec.libraries, manifests.versionData, manifests.spec.id);
            if (!dry) {
                cauldronLogger.info('All Files Acquired Building Launch File');
                cauldronLogger.info('Creating JVM Arguments');
                if (manifests.spec.logging) {
                    await logInjector(path.join(CAULDRON_PATH, 'assets', 'log_configs', manifests.spec.logging.client.file.id), sessionID)
                }
                let validRules = await buildJVMRules(manifests.spec, libGet, manifests.versionData, overrides.jvm);
                cauldronLogger.info('Generating Game Arguments');
                let gameRules = await buildGameRules(manifests.spec, authData, overrides.game, overrides.additG);
                let launchPath = await buildFile(manifests.spec, manifests.jvmComp, validRules, gameRules);
                cauldronLogger.info('Starting Game');
                setLoggerSession(sessionID);
                exec(`cd ${CAULDRON_PATH} && ${launchPath}`);
                resolve(sessionID);
            } else {
                await destroySession(sessionID);
                cauldronLogger.info("Game Installed");
                resolve(true);
            }

        } catch (err) {
            await destroySession(sessionID);
            cauldronLogger.error(err.message);
            resolve(err.message)
        }
    })

}


module.exports = {launchGame};