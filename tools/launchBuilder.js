const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const osCurrent = require('os').platform();
const { exec, spawn } = require('child_process');

const { grabPath, getOperatingSystem } = require('../tools/compatibility');
var forceComp = require('../plugins/forge/files/force_compat.json')
var requiresLibPatch = require('../files/requiresLibPatch.json');
const package = require('../package.json');
const defaultJVM = require('../files/defaultJVMArguments.json');
const { getJVMArgsPlugin } = require('../plugins/plugins')


// Varible Injector
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

// Injects current Session ID into log file and creates new file
async function logInjector(logFile, sessionID) {
    var CAULDRON_PATH = grabPath();
    var logFileCont = fs.readFileSync(logFile).toString();
    logFileCont = injector.create(logFileCont, { 'log_loc': path.join(CAULDRON_PATH, 'sessionLogs', sessionID, 'mcLogs.log') });
    fs.writeFileSync(path.join(logFile, '../', 'log_config.xml'), logFileCont)
};


async function buildJVMRules(manifest, libraryList, versionData, overides) {
    return new Promise(async (resolve) => {
        var CAULDRON_PATH = grabPath();
        var cusJVM = defaultJVM;
        // Aquire Set Version
        if (overides) {
            for (idx in overides) {
                cusJVM[idx] = overides[idx]
            };
        };
        var setVersion = versionData.version;
        if (versionData.loader != 'vanilla') {
            setVersion = `${versionData.loader}-${versionData.version}-${versionData.loaderVersion}`;
            libraryList.push(path.join(CAULDRON_PATH, 'libraries', 'net', 'minecraftforge', 'forge', `${versionData.version}-${versionData.loaderVersion}`, `forge-${versionData.version}-${versionData.loaderVersion}.jar`));
        };
        libraryList.push(path.join(CAULDRON_PATH, 'versions', manifest.id, `${manifest.id}.jar`));
        jvmRules = manifest.arguments.jvm;
        var validRules = new Array();
        for (idx in jvmRules) {
            if (!jvmRules[idx].rules) {
                if (jvmRules[idx]) {
                    validRules.push(jvmRules[idx])
                } else {
                    validRules.push(jvmRules[idx].value)
                }

            } else if (jvmRules[idx].rules[0].os) {
                if (jvmRules[idx].rules[0].os.name == getOperatingSystem()) {
                    if (Array.isArray(jvmRules[idx].value)) {

                        validRules.push(jvmRules[idx].value.pop())
                    } else {
                        validRules.push(jvmRules[idx].value)
                    }
                };
            };
        };

        var logPath = "";
        if (manifest.logging) {
            validRules.push(manifest.logging.client.argument);
            logPath = path.join(CAULDRON_PATH, 'assets', 'log_configs', manifest.logging.client.file.id)
        };

        //Check if version requires proxy
        var proxyPort = false;
        var vArray = ["1.0", "1.1", "1.3", "1.4", "1.5"]
        var splitVersion = `${versionData.version.split(".")[0]}.${versionData.version.split(".")[1]}`
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
        };
        var libOccurneces = {};
        var repeatedLibs = {};
        for (idx in libraryList) {
            var libPath = libraryList[idx].split("\\")[libraryList[idx].split("\\").length - 3];
            if (libOccurneces[libPath]) {
                libOccurneces[libPath].push(libraryList[idx]);
                repeatedLibs[libPath] = libOccurneces[libPath];
            } else {
                libOccurneces[libPath] = [libraryList[idx]];
            };
        };

        if (requiresLibPatch[versionData.loader].includes(versionData.version)) {
            for (rLibs in repeatedLibs) {
                var index = libraryList.indexOf(repeatedLibs[rLibs][0])
                libraryList.splice(index, 1);
            };
        };
        // Run Plugin Code
        const plugin = await getJVMArgsPlugin(versionData.loader, { manifest, libraryList, versionData, overides })
        if (plugin) {
            manifest = plugin.manifest;
            libraryList = plugin.libraryList;
            versionData = plugin.versionData;
            overides = plugin.overides;
        };
        // Convert Library List into Joined List
        var classPathSep = ""
        if (osCurrent == 'win32') {
            classPath = libraryList.join(";")
            classPathSep = ';'
        } else {
            classPath = libraryList.join(":")
            classPathSep = ':'
        };

        var relVaribles = {
            natives_directory: path.join(CAULDRON_PATH, 'versions', manifest.id, 'natives'),
            launcher_name: cusJVM.launcher_name,
            launcher_version: package.version,
            client_jar: path.join(CAULDRON_PATH, 'versions', manifest.id, manifest.id + ".jar"),
            classpath: classPath,
            path: path.join(CAULDRON_PATH, 'assets', 'log_configs', 'log_config.xml'),
            ram: cusJVM.ram,
            classpath_separator: classPathSep,
            library_directory: path.join(CAULDRON_PATH, 'libraries').split("\\").join("/")

        };
        for (rIdx in validRules) {
            if (validRules[rIdx]) {
                validRules[rIdx] = injector.create(validRules[rIdx], relVaribles);
            }
        };
        resolve(validRules);
    })
};

async function buildGameRules(manifest, loggedUser, overides, addit) {
    return new Promise(async (resolve) => {
        var CAULDRON_PATH = grabPath();
        var gameRules = new Array();
        allGameRules = manifest.arguments.game;
        for (gRules in allGameRules) {
            if (!allGameRules[gRules].rules) {
                gameRules.push(allGameRules[gRules])
            }
        };
        if (!gameRules.includes("--versionType")) {
            gameRules.push('--versionType');
            gameRules.push('${version_type}')
        };

        var gameVars = {
            auth_player_name: loggedUser.profile.username,
            version_type: manifest.type,
            game_directory: CAULDRON_PATH,
            server_ip: '',
        };
        for (idx in overides) {
            gameVars[idx] = overides[idx]
        };

        var gameVariables = {
            auth_player_name: gameVars.auth_player_name,
            version_name: manifest.id,
            game_directory: gameVars.game_directory,
            assets_root: path.join(CAULDRON_PATH, 'assets'),
            assets_index_name: manifest.assets,
            auth_uuid: loggedUser.profile.uuid,
            auth_access_token: loggedUser.access_token,
            clientid: loggedUser.user_id,
            game_assets: path.join(CAULDRON_PATH, 'resources'),
            auth_xuid: loggedUser.xui,
            user_type: 'msa',
            version_type: gameVars.version_type,
            user_properties: "{}",
            auth_session: `token:${loggedUser.access_token}`,
            server_ip: gameVars.server_ip
        };
        if (manifest.assets == 'legacy') {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy');
        } else if (manifest.assets == 'pre-1.6') {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'resources');
        } else {
            gameVariables.game_assets = path.join(CAULDRON_PATH, 'assets');
        };
        for (idx in addit) {
            gameRules.push(addit[idx])
        }
        if (gameVars.server_ip != '') {
            if (Number(manifest.id.split(".")[1]) >= 20) {
                gameRules.push('--quickPlayMultiplayer');
            } else {
                gameRules.push('--server');
            }
            gameRules.push('${server_ip}');
        }
        for (gIdx in gameRules) {
            gameRules[gIdx] = injector.create(gameRules[gIdx], gameVariables);
        };
        // Grab Additonal
        resolve(gameRules);
    });
};

async function buildFile(manifest, jreVersion, validRules, gameRules) {
    var CAULDRON_PATH = grabPath();
    var mainClass = manifest.mainClass;
    if (osCurrent == 'darwin') {
        javaPath = path.join(CAULDRON_PATH, 'jvm', jreVersion, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
    } else {
        javaPath = path.join(CAULDRON_PATH, 'jvm', jreVersion, 'bin', 'java');
    }

    var launchCommand = `${javaPath} ${validRules.join(" ")} ${mainClass} ${gameRules.join(" ")}`;
    shell.mkdir('-p', path.join(CAULDRON_PATH, 'scripts'))

    if (osCurrent == 'linux' || osCurrent == 'darwin') {
        fs.writeFileSync(path.join(CAULDRON_PATH, 'scripts', 'launch.sh'), `${launchCommand}`);
        const validateScript = exec(`cd ${path.join(CAULDRON_PATH, 'scripts')} && chmod +x launch.sh`);
        const validateJava = exec(`cd ${path.join(javaPath, '../')} && chmod +x java`);
        return path.join(CAULDRON_PATH, 'scripts', 'launch.sh');
    } else if (osCurrent == 'win32') {
        fs.writeFileSync(path.join(CAULDRON_PATH, 'scripts', 'launch.bat'), `${launchCommand}`);
        return path.join(CAULDRON_PATH, 'scripts', 'launch.bat');
    }


};

module.exports = { buildJVMRules, buildGameRules, buildFile, logInjector }