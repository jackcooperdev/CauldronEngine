const path = require('path')
const { exec } = require('child_process');
const osCurrent = require('os').platform();


const { grabPath } = require('../tools/compatibility');
const { getAssets } = require("./assets");
const { checkJVM } = require("./jvm");
const { getLibraries } = require("./libraries");
const { getManifests } = require('./manifest')
const { cauldronLogger, setLoggerSession } = require('../tools/logger');
const { grabForgeProcs, postProcessing } = require("../plugins/forge");
const { createSession, destroySession } = require("../tools/sessionManager");
const { buildJVMRules, buildGameRules, buildFile, logInjector } = require("../tools/launchBuilder");



async function launchGame(version, dry, loader, lVersion, authData, sessionID, overrides) {
    if (!dry) {
        dry = false;
    };
    if (!overrides) {
        overrides = { 'jvm': {}, 'game': {}, 'additG': {} };
    }
    if (!loader) {
        loader = 'vanilla';
    };
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {
            // Create SessionID If Not Declared
            if (!sessionID) {
                var newSession = {
                    type: 'game',
                    version: version,
                    loader: loader,
                    overrides: overrides
                };
                sessionID = createSession(newSession);
            }
            cauldronLogger.info("Session ID: " + sessionID)
            //Aquire Manifests (All)
            // Finds ALL Manifests Required for version. Offline Failsafe
            const manifests = await getManifests(version, loader, lVersion);
            cauldronLogger.info("Manifests Got!")
            if (!manifests.jvmDownloaded) {
                cauldronLogger.info(`Getting JVM: ${manifests.jvmComp}`);
                const jvmDown = await checkJVM(manifests.jvmComp, manifests.jvmMani);
                cauldronLogger.info('JVM Passed!');
            } else {
                cauldronLogger.info("Skipping JVM")
            }
            if (!manifests.assetsDownloaded) {
                cauldronLogger.info('Starting Asset Download');
                cauldronLogger.info(`Index No: ${manifests.spec.assets}`);
                cauldronLogger.info(`Index URL: ${manifests.spec.assetIndex.url}`)
                const assetGet = await getAssets(manifests.spec.assets, manifests.aseetsInfo);
            } else {
                cauldronLogger.info("Skipping Assets");
            };
            cauldronLogger.info('Starting Library Download')
            const libGet = await getLibraries(manifests.spec.libraries, osCurrent, manifests.versionData);
            if (!dry) {
                cauldronLogger.info('All Files Aquired Building Launch File');
                cauldronLogger.info('Creating JVM Arguments');
                ////console.log(manifests.spec)
                var logsInjected = await logInjector(path.join(CAULDRON_PATH, 'assets', 'log_configs', 'client-1.7.xml'), sessionID)
                var validRules = await buildJVMRules(manifests.spec, libGet, manifests.versionData, overrides.jvm);
                cauldronLogger.info('Generating Game Arguments');
                var gameRules = await buildGameRules(manifests.spec, authData, overrides.game, overrides.additG);
                var launchPath = await buildFile(manifests.spec, manifests.jvmComp, validRules, gameRules);
                cauldronLogger.info('Starting Game');
                setLoggerSession(sessionID);
                const exe = exec(`cd ${CAULDRON_PATH} && ${launchPath}`);
                resolve(sessionID);
            } else {
                destroySession(sessionID);
                cauldronLogger.info("Game Installed");
            }

        } catch (err) {
            cauldronLogger.error(err);
            resolve(false)
        }
    })

};


module.exports = { launchGame };