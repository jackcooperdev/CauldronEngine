const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const osCurrent = require('os').platform();
const { exec } = require('child_process');

const { grabPath, getOperatingSystem } = require('../tools/compatibility');
let requiresLibPatch = require('../files/requiresLibPatch.json');
const systemPKG = require('../package.json');
const defaultJVM = require('../files/defaultJVMArguments.json');
const { getJVMArgsPlugin } = require('../plugins/plugins')


// Variable Injector
let injector = {
    create: (function () {
        let regexp = /\${([^{]+)}/g;

        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? '' : key;
            });
        }
    })()
};

// Injects current Session ID into log file and creates new file
async function logInjector(logFile, sessionID) {
    let CAULDRON_PATH = grabPath();
    let logFileCont = fs.readFileSync(logFile).toString();
    logFileCont = injector.create(logFileCont, { 'log_loc': path.join(CAULDRON_PATH, 'sessionLogs', sessionID, 'mcLogs.log') });
    fs.writeFileSync(path.join(logFile, '../', 'log_config.xml'), logFileCont)
}


async function buildJVMRules(manifest, libraryList, versionData, overrides) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let cusJVM = defaultJVM;
        // Acquire Set Version
        if (overrides) {
            for (let idx in overrides) {
                cusJVM[idx] = overrides[idx]
            }
        }
        if (versionData.loader !== 'vanilla') {
            libraryList.push(path.join(CAULDRON_PATH, 'libraries', 'net', 'minecraftforge', 'forge', `${versionData.version}-${versionData.loaderVersion}`, `forge-${versionData.version}-${versionData.loaderVersion}.jar`));
        }
        libraryList.push(path.join(CAULDRON_PATH, 'versions', manifest.id, `${manifest.id}.jar`));
        let jvmRules = manifest.arguments.jvm;
        let validRules = [];
        for (let idx in jvmRules) {
            if (!jvmRules[idx].rules) {
                if (jvmRules[idx]) {
                    validRules.push(jvmRules[idx])
                } else {
                    validRules.push(jvmRules[idx].value)
                }

            } else if (jvmRules[idx].rules[0].os) {
                if (jvmRules[idx].rules[0].os.name === getOperatingSystem()) {
                    if (Array.isArray(jvmRules[idx].value)) {

                        validRules.push(jvmRules[idx].value.pop())
                    } else {
                        validRules.push(jvmRules[idx].value)
                    }
                }
            }
        }

        /**
         * @param manifest.logging.client.argument
         */
        if (manifest.logging) {
            validRules.push(manifest.logging.client.argument)
        }

        //Check if version requires proxy
        let proxyPort = false;
        let vArray = ["1.0", "1.1", "1.3", "1.4", "1.5"]
        let splitVersion = `${versionData.version.split(".")[0]}.${versionData.version.split(".")[1]}`
        if (versionData.version.startsWith("a1.0.")) {
            proxyPort = 80;
        } else if (versionData.version.startsWith('a1.1.')) {
            proxyPort = 11702;
        } else if (versionData.version.startsWith('a1.') || versionData.version.startsWith('b1.')) {
            proxyPort = 11705;
        } else if (vArray.includes(versionData.version) || versionData.version.startsWith(vArray) || vArray.includes(splitVersion)) {
            proxyPort = 11707;
        }
        if (proxyPort) {
            validRules.push("-Dhttp.proxyHost=betacraft.uk");
            validRules.push("-Dhttp.proxyPort=" + proxyPort)
        }
        let libOccurrences = {};
        let repeatedLibs = {};
        for (let idx in libraryList) {
            let libPath = libraryList[idx].split("\\")[libraryList[idx].split("\\").length - 3];
            if (libOccurrences[libPath]) {
                libOccurrences[libPath].push(libraryList[idx]);
                repeatedLibs[libPath] = libOccurrences[libPath];
            } else {
                libOccurrences[libPath] = [libraryList[idx]];
            }
        }

        if (requiresLibPatch[versionData.loader].includes(versionData.version)) {
            for (let rLibs in repeatedLibs) {
                let index = libraryList.indexOf(repeatedLibs[rLibs][0])
                libraryList.splice(index, 1);
            }
        }
        // Run Plugin Code
        const plugin = await getJVMArgsPlugin(versionData.loader, { manifest, libraryList, versionData, overrides })
        if (plugin) {
            manifest = plugin.manifest;
            libraryList = plugin.libraryList;
            versionData = plugin.versionData;
            overrides = plugin.overides;
        }
        // Convert Library List into Joined List
        let classPathSep;
        let classPath;
        if (osCurrent === 'win32') {
            classPath = libraryList.join(";")
            classPathSep = ';'
        } else {
            classPath = libraryList.join(":")
            classPathSep = ':'
        }

        let relVariables = {
            natives_directory: path.join(CAULDRON_PATH, 'versions', manifest.id, 'natives'),
            launcher_name: cusJVM.launcher_name,
            launcher_version: systemPKG.version,
            client_jar: path.join(CAULDRON_PATH, 'versions', manifest.id, manifest.id + ".jar"),
            classpath: classPath,
            path: path.join(CAULDRON_PATH, 'assets', 'log_configs', 'log_config.xml'),
            ram: cusJVM.ram,
            classpath_separator: classPathSep,
            library_directory: path.join(CAULDRON_PATH, 'libraries').split("\\").join("/")

        };
        for (let rIdx in validRules) {
            if (validRules[rIdx]) {
                validRules[rIdx] = injector.create(validRules[rIdx], relVariables);
            }
        }
        resolve(validRules);
    })
}

async function buildGameRules(manifest, loggedUser, overrides, addit) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let gameRules = [];
        let allGameRules = manifest.arguments.game;
        for (let gRules in allGameRules) {
            if (!allGameRules[gRules].rules) {
                gameRules.push(allGameRules[gRules])
            }
        }
        if (!gameRules.includes("--versionType")) {
            gameRules.push('--versionType');
            gameRules.push('${version_type}')
        }

        let gameVars = {
            auth_player_name: loggedUser.profile.username,
            version_type: manifest.type,
            game_directory: CAULDRON_PATH,
            server_ip: '',
        };
        for (let idx in overrides) {
            gameVars[idx] = overrides[idx]
        }

        let gameVariables = {
            auth_player_name: gameVars.auth_player_name,
            version_name: manifest.id,
            game_directory: gameVars.game_directory,
            assets_root: path.join(CAULDRON_PATH, 'assets'),
            assets_index_name: manifest.assets,
            auth_uuid: loggedUser.profile.uuid,
            auth_access_token: loggedUser.access_token,
            CLIENT_ID: loggedUser.user_id,
            game_assets: path.join(CAULDRON_PATH, 'resources'),
            auth_xuid: loggedUser.xui,
            user_type: 'msa',
            version_type: gameVars.version_type,
            user_properties: "{}",
            auth_session: `token:${loggedUser.access_token}`,
            server_ip: gameVars.server_ip
        };
        if (manifest.assets === 'legacy') {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy');
        } else if (manifest.assets === 'pre-1.6') {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'resources');
        } else {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'assets');
        }
        for (let idx in addit) {
            gameRules.push(addit[idx])
        }
        if (gameVars.server_ip !== '') {
            if (Number(manifest.id.split(".")[1]) >= 20) {
                gameRules.push('--quickPlayMultiplayer');
            } else {
                gameRules.push('--server');
            }
            gameRules.push('${server_ip}');
        }
        for (let gIdx in gameRules) {
            gameRules[gIdx] = injector.create(gameRules[gIdx], gameVariables);
        }
        // Grab Additional
        resolve(gameRules);
    });
}

async function buildFile(manifest, jreVersion, validRules, gameRules) {
    let CAULDRON_PATH = grabPath();
    let mainClass = manifest.mainClass;
    let javaPath;
    if (osCurrent === 'darwin') {
        javaPath = path.join(CAULDRON_PATH, 'jvm', jreVersion, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
    } else {
        javaPath = path.join(CAULDRON_PATH, 'jvm', jreVersion, 'bin', 'java');
    }

    let launchCommand = `${javaPath} ${validRules.join(" ")} ${mainClass} ${gameRules.join(" ")}`;
    shell.mkdir('-p', path.join(CAULDRON_PATH, 'scripts'))

    if (osCurrent === 'linux' || osCurrent === 'darwin') {
        fs.writeFileSync(path.join(CAULDRON_PATH, 'scripts', 'launch.sh'), `${launchCommand}`);
        exec(`cd ${path.join(CAULDRON_PATH, 'scripts')} && chmod +x launch.sh`);
        exec(`cd ${path.join(javaPath, '../')} && chmod +x java`);
        return path.join(CAULDRON_PATH, 'scripts', 'launch.sh');
    } else if (osCurrent === 'win32') {
        fs.writeFileSync(path.join(CAULDRON_PATH, 'scripts', 'launch.bat'), `${launchCommand}`);
        return path.join(CAULDRON_PATH, 'scripts', 'launch.bat');
    }


}

module.exports = { buildJVMRules, buildGameRules, buildFile, logInjector }