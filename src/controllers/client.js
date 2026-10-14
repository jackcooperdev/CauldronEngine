const VERIFIED_LOADERS = require('../files/verifiedLoaders.json');
const PATCHES = require('../files/patches.json');
const { cauldronLogger } = require('../tools/logger');
const { getOperatingSystem, grabEnginePath } = require('../tools/compatibility');
const { createUUID } = require('../tools/fileTools');
const { getQueue, getCEObject } = require('./manifest');
const { verifyInstallation } = require('./queue');
const { logInjector, buildJVMRules, buildGameRules, buildFile } = require('../tools/launchBuilder');
const path = require('path')
const JSZip = require('jszip');
const fs = require('fs')
const { spawn } = require("child_process");
async function startGame(version, loaderInfo, authInfo, overrides) {
    return new Promise(async (resolve, reject) => {
        try {
            const CE_OBJECT = await installGame(version, loaderInfo);
            let CAULDRON_PATH = grabEnginePath();
            let sessionID = createUUID();
            if (!overrides) {
                overrides = { jvm: {}, game: {}, additG: {} };
            }

            // Setup Logger
            if (CE_OBJECT.loggingInfo) {
                await logInjector(path.join(CAULDRON_PATH, 'assets', 'log_configs', CE_OBJECT.loggingInfo.id), sessionID);
            } else {
                sessionID = 'DETACH'
            };

            // Grab Spec File
            const SPEC_FILE = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, CE_OBJECT.specPath)).toString())


            // Aquire Natives

            let nativeList = CE_OBJECT.nativeList;

            console.log(nativeList);
            const IGNORE_LIST = ["META-INF", ".git", ".sha1"];
            fs.mkdirSync(path.join(CAULDRON_PATH, 'temp'), { recursive: true })
            for (let native of nativeList) {
                const data = fs.readFileSync(native);
                const zip = await JSZip.loadAsync(data)
                const relFiles = Object.keys(zip.files).filter(
                    file => !IGNORE_LIST.some(ignored => file.includes(ignored))
                );
                for (let relFile of relFiles) {
                    const fileBuffer = await zip.files[relFile].async('nodebuffer')
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'temp', relFile), fileBuffer)
                    console.log('WIRTEACTION')
                }
            }

            // Create JVM Rules
            const validRules = await buildJVMRules(SPEC_FILE, CE_OBJECT.libList, { version }, overrides.jvm, true);

            // Build Game Rules

            const gameRules = await buildGameRules(SPEC_FILE, authInfo, overrides.game, true);

            // Build Launch Script
            const launchPath = await buildFile(SPEC_FILE, CE_OBJECT.jreVersion, validRules, gameRules, true);

            let launchDirectory = `${CAULDRON_PATH}`;
            if (overrides["game"]) {
                if (overrides["game"]["game_directory"]) {
                    launchDirectory = `${overrides["game"]["game_directory"]}`;
                }
            }


            //process.exit(0);

            // Launch Game
            const isWindows = getOperatingSystem() === 'windows';
            const dirToDelete = path.join(CAULDRON_PATH,'temp')

            const child = isWindows
                ? spawn('cmd', ['/c', `cd /d "${launchDirectory}" && start "" /wait "${launchPath}" & cd /d "%TEMP%" & rmdir /s /q "${dirToDelete}"`], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                })
                : spawn('sh', ['-c', `cd "${launchDirectory}" && "${launchPath}"; cd / && rm -rf "${dirToDelete}"`], {
                    detached: true,
                    stdio: 'ignore'
                });
            child.unref();
            resolve(sessionID);


        } catch (e) {
            reject(e)
        }





    })
}



async function installGame(version, loaderInfo) {
    return new Promise(async (resolve, reject) => {
        try {


            if (!loaderInfo) {
                loaderInfo = { type: 'vanilla' };
            };


            const loaderAccepted = VERIFIED_LOADERS.includes(loaderInfo.type);
            if (!loaderAccepted) {
                cauldronLogger.error('Loader Not Supported! Defaulting to Vanilla')
                loaderInfo.type = 'vanilla'
            };

            let installObject = {
                version,
                loader: loaderInfo.type,
                lv: loaderInfo.version,
            };
            if (!installObject.lv) {
                installObject.lv = 'release'
            }

            const fullOperatingSystem = getOperatingSystem(true);

            let foundPatches = PATCHES.filter(obj => obj.affected_operating_systems.includes(fullOperatingSystem) && obj.affected_versions.includes(installObject.version))

            for (let patch of foundPatches) {
                cauldronLogger.info(`Applying Patch: ${patch.name}`);
                installObject = { ...installObject, ...patch.patch }
            };


            let CAULDRON_PATH = grabEnginePath();
            let SESSION_ID = createUUID();

            cauldronLogger.debug(`Session ID: ${SESSION_ID}`);

            const CE_OBJECT = await getCEObject(installObject);

            await verifyInstallation(CE_OBJECT.installQueue);

            resolve(CE_OBJECT);

        } catch (e) {
            reject(e);
        }







    })
}




module.exports = { startGame, installGame }