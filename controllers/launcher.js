const { getAssets } = require("./assets");
const { login, authenticate, verifyAccessToken } = require("./auth");
const { checkJVM, checkCompat, downloadJVM } = require("./jvm");
const { getLibraries } = require("./libraries");
const path = require('path')
const fs = require('fs');
const { exec } = require('child_process');
const osCurrent = require('os').platform();
const shell = require('shelljs');
const { attemptToConvert, buildJVMRules, buildGameRules, buildFile } = require("../tools/launchBuilder");
const { grabPath } = require('../tools/compatibility');
const { cauldronLogger } = require('../tools/logger');
const { grabForgeProcs, postProcessing } = require("../plugins/forge");
const { createSession, destroySession, getSession } = require("../tools/sessionManager");
const { isOffline } = require("../tools/isClientOffline");
const { getManifests } = require('./manifest')

const homedir = require('os').homedir()
const MAIN_MANIFEST = "https://launchermeta.mojang.com/mc/game/version_manifest.json";


var game_status = false;

var injector = {
    create: (function () {
        var regexp = /\${([^{]+)}/g;

        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? '' : key;
            });
        }
    })()
};

var additFun = {
    'forge': postProcessing
}


async function launchGame(version, dry, loader, lVersion, authData, sessionID, overrides) {
    if (!dry) {
        dry = false;
    };
    if (!overrides) {
        overrides = {'jvm':{},'game':{}, 'additG': {}};
    }
    if (!loader) {
        loader = 'vanilla';
    };
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {
            // Check If SessionID matches current session if not fail
            // If none exists create
            if (sessionID) {
                var actualCurrentSess = getSession().id;
                if (actualCurrentSess != sessionID) {
                    reject('Session Already Active');
                }
            } else {
                if (!getSession().id) {
                    createSession();
                } else {
                    reject('Session Already Active');
                };
            };
            cauldronLogger.info("Session ID: "+getSession().id)
            //Aquire Manifests (All)
            // Finds ALL Manifests Required for version. Offline Failsafe
            const manifests = await getManifests(version, loader, lVersion);
            cauldronLogger.info("Manifests Got!")
            cauldronLogger.info(`Getting JVM: ${manifests.jvmComp}`);
            const jvmDown = await checkJVM(manifests.jvmComp,manifests.jvmMani);
            cauldronLogger.info('JVM Passed!');
            
            //if (!manifests.assetsDownloaded) {
           // var start = new Date().getTime()
                cauldronLogger.info('Starting Asset Download');
                cauldronLogger.info(`Index No: ${manifests.spec.assets}`);
                cauldronLogger.info(`Index URL: ${manifests.spec.assetIndex.url}`)
                const assetGet = await getAssets(manifests.spec.assets, manifests.aseetsInfo);
            //} else {
                //cauldronLogger.info("Skipping Assets");
           // };
           // console.log(end-start);
            cauldronLogger.info('Starting Library Download')
            const libGet = await getLibraries(manifests.spec.libraries, osCurrent, manifests.versionData);
            if (!dry) {
                cauldronLogger.info('All Files Aquired Building Launch File');
                cauldronLogger.info('Creating JVM Arguments');
                //console.log(manifests.spec)
                var validRules = await buildJVMRules(manifests.spec, libGet, manifests.versionData,overrides.jvm);
                cauldronLogger.info('Generating Game Arguments')
                var gameRules = await buildGameRules(manifests.spec, authData,overrides.game,overrides.additG);
                console.log(gameRules)
                var launchPath = await buildFile(manifests.spec, manifests.jvmComp, validRules, gameRules);
                cauldronLogger.info('Starting Game');
                const exe = exec(`cd ${CAULDRON_PATH} && ${launchPath}`);
                resolve(true);
            } else {
                destroySession();
                cauldronLogger.info("Game Installed");
            }

        } catch (err) {
            cauldronLogger.error(err);
            resolve(false)
        }
    })

};


module.exports = { launchGame };