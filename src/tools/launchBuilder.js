const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { grabPath, getOperatingSystem } = require("./compatibility.js");
const { jwtDecode } = require("jwt-decode");
const pkgJSON = require('../../package.json')

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const systemPKG = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const defaultJVM = {
    "launcher_name": "CauldronEngine",
    "ram_low": "4",
    "ram": "8"
}


const osCurrent = os.platform();

// Variable Injector
let injector = {
    create: (function () {
        let regexp = /\${([^{]+)}/g;

        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? "" : key;
            });
        };
    })(),
};

// Injects current Session ID into a log file and creates a new file
async function logInjector(logFile, sessionID) {
    let CAULDRON_PATH = grabPath();
    try {
        let logFileCont = fs.readFileSync(logFile).toString();
        logFileCont = injector.create(logFileCont, {
            log_loc: path.join(CAULDRON_PATH, "sessionLogs", sessionID, "mcLogs.log"),
        });
        fs.writeFileSync(path.join(logFile, "../", "log_config.xml"), logFileCont);
    } catch (e) {
        fs.mkdirSync(path.join(logFile, "../"), { recursive: true });
        fs.writeFileSync(path.join(logFile, "../", "log_config.xml"), "");
    }
}

async function buildJVMRules(manifest, libraryList, versionData, overrides) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let cusJVM = defaultJVM;
        // Acquire Set Version
        if (overrides) {
            for (let idx in overrides) {
                cusJVM[idx] = overrides[idx];
            }
        }
        libraryList.push(path.join(CAULDRON_PATH, "versions", manifest.id, `${manifest.id}.jar`),);
        let jvmRules = manifest.arguments.jvm;
        let validRules = [];
        for (let idx in jvmRules) {
            if (!jvmRules[idx].rules) {
                if (jvmRules[idx]) {
                    validRules.push(jvmRules[idx]);
                } else {
                    validRules.push(jvmRules[idx].value);
                }
            } else if (jvmRules[idx].rules[0].os) {
                if (jvmRules[idx].rules[0].os.name === getOperatingSystem()) {
                    if (Array.isArray(jvmRules[idx].value)) {
                        validRules.push(jvmRules[idx].value.pop());
                    } else {
                        validRules.push(jvmRules[idx].value);
                    }
                }
            }
        }
        /**
         * @param manifest.logging.client.argument
         */
        if (manifest.logging) {
            validRules.push(manifest.logging.client.argument);
        }

        //Check if a version requires proxy
        let proxyPort = false;
        let vArray = ["1.0", "1.1", "1.3", "1.4", "1.5"];
        let splitVersion = `${versionData.version.split(".")[0]}.${versionData.version.split(".")[1]}`;
        if (versionData.version.startsWith("a1.0.")) {
            proxyPort = 80;
        } else if (versionData.version.startsWith("a1.1.")) {
            proxyPort = 11702;
        } else if (versionData.version.startsWith("a1.") || versionData.version.startsWith("b1.")) {
            proxyPort = 11705;
        } else if (vArray.includes(versionData.version) || versionData.version.startsWith(vArray) || vArray.includes(splitVersion)) {
            proxyPort = 11707;
        }
        if (proxyPort) {
            validRules.push("-Dhttp.proxyHost=betacraft.uk");
            validRules.push("-Dhttp.proxyPort=" + proxyPort);
        }


        // Convert Library List into Joined List
        let classPathSep;
        let classPath;
        libraryList = libraryList.filter(path => !path.endsWith('.lzma'));
        if (osCurrent === "win32") {
            classPath = libraryList.join(";");
            classPathSep = ";";
        } else {
            classPath = libraryList.join(":");
            classPathSep = ":";
        }
        let relVariables = {
            natives_directory: path.join(CAULDRON_PATH, "versions", manifest.id, "natives",),
            launcher_name: cusJVM.launcher_name,
            version_name: manifest.id,
            launcher_version: pkgJSON.version,
            client_jar: path.join(CAULDRON_PATH, "versions", manifest.id, manifest.id + ".jar",),
            classpath: classPath,
            path: path.join(CAULDRON_PATH, "assets", "log_configs", "log_config.xml"),
            ram: cusJVM.ram,
            ram_low: cusJVM.ram_low,
            classpath_separator: classPathSep,
            library_directory: path
                .join(CAULDRON_PATH, "libraries")
                .split("\\")
                .join("/"),
        };
        for (let rIdx in validRules) {
            if (validRules[rIdx]) {
                validRules[rIdx] = injector.create(validRules[rIdx], relVariables);
            }
        }
        resolve(validRules);
    });
}

async function buildGameRules(manifest, loggedUser, overrides, addit) {
    return new Promise(async (resolve) => {
        let CAULDRON_PATH = grabPath();
        let gameRules = [];
        let allGameRules = manifest.arguments.game;
        for (let gRules in allGameRules) {
            if (!allGameRules[gRules].rules) {
                gameRules.push(allGameRules[gRules]);
            }
        }
        if (!gameRules.includes("--versionType")) {
            gameRules.push("--versionType");
            gameRules.push("${version_type}");
        }

        let decodedToken = jwtDecode(loggedUser)
        
        let gameVars = {
            username: 'none',
            version_type: manifest.type,
            game_directory: CAULDRON_PATH,
            server_ip: "",
            uuid:'none',
            xuid :'none',
            clientId:'none'
        };
        if (decodedToken.pfd) {
            gameVars.username = decodedToken.pfd[0].name;
            gameVars.uuid = decodedToken.pfd[0].id;
            gameVars.xuid = decodedToken.xuid
            gameVars.clientId = decodedToken.sub
        }

        for (let idx in overrides) {
            gameVars[idx] = overrides[idx];
        }

        let gameVariables = {
            auth_player_name: gameVars.username,
            version_name: manifest.id,
            game_directory: gameVars.game_directory,
            assets_root: path.join(CAULDRON_PATH, "assets"),
            assets_index_name: manifest.assets,
            auth_uuid: gameVars.uuid,
            auth_access_token: loggedUser,
            CLIENT_ID: gameVars.clientId,
            game_assets: path.join(CAULDRON_PATH, "resources"),
            auth_xuid: gameVars.xuid,
            user_type: "msa",
            version_type: gameVars.version_type,
            user_properties: "{}",
            auth_session: `token:${loggedUser}`,
            server_ip: gameVars.server_ip,
        };
        if (manifest.assets === "legacy") {
            gameVariables.game_assets = path.join(CAULDRON_PATH, "assets", "virtual", "legacy",);
        } else if (manifest.assets === "pre-1.6") {
            gameVariables.game_assets = path.join(CAULDRON_PATH, "resources");
        } else {
            gameVariables.game_assets = path.join(CAULDRON_PATH, "assets");
        }
        for (let idx in addit) {
            gameRules.push(addit[idx]);
        }
        if (gameVars.server_ip !== "") {
            gameRules.push("--quickPlayMultiplayer");
            gameRules.push("${server_ip}");
            gameRules.push("--server");
            gameRules.push("${server_ip}");
        }
        for (let gIdx in gameRules) {
            gameRules[gIdx] = injector.create(gameRules[gIdx], gameVariables);
        }
        // Grab Additional
        resolve(gameRules);
    });
}

async function buildLaunchScript(manifest, jreVersion, sessionName) {
    let CAULDRON_PATH = grabPath();
    let javaPath;
    let launchArguments;
    let serverArgs = manifest.arguments.server;
    if (!serverArgs) {
        serverArgs = { unix: '', win: '' }
    }
    if (osCurrent === "darwin") {
        launchArguments = atob(serverArgs['unix'])
        javaPath = path.join(CAULDRON_PATH, "jvm", jreVersion, "jre.bundle", "Contents", "Home", "bin", "java",);
    } else if (osCurrent === 'linux') {
        launchArguments = atob(serverArgs['unix']);
        javaPath = path.join(CAULDRON_PATH, "jvm", jreVersion, "bin", "java");
    } else {
        launchArguments = atob(serverArgs['win'])
        javaPath = path.join(CAULDRON_PATH, "jvm", jreVersion, "bin", "javaw");
    }
    let jarFile;

    if (manifest.loader !== 'vanilla') {
        jarFile = path.join(CAULDRON_PATH, 'servers', `${sessionName}/${manifest.id}.jar`)
    } else {
        jarFile = path.join(CAULDRON_PATH, 'servers', `${sessionName}/minecraft_server.${manifest.id}.jar`)
    }
    let launchCommand;
    let aikarFlags = getAikarFlags(4).join(" ");
    if (launchArguments) {
        launchCommand = `${javaPath} -Xmx4G -Xms4G ${aikarFlags} ${launchArguments} nogui`;
    } else {
        launchCommand = `${javaPath} -Xmx4G -Xms4G ${aikarFlags} -jar ${jarFile} nogui`;
    }


    const scriptDir = path.join(CAULDRON_PATH, "scripts");
    fs.mkdirSync(scriptDir, { recursive: true });

    if (osCurrent === "linux" || osCurrent === "darwin") {
        const scriptPath = path.join(scriptDir, "launch-server.sh");
        fs.writeFileSync(scriptPath, launchCommand);
        await new Promise((res, rej) => {
            exec(`chmod +x "${scriptPath}"`, (err) => {
                if (err) return rej(err);
                res();
            });
        });
        await new Promise((res, rej) => {
            exec(`chmod +x "${javaPath}"`, (err) => {
                if (err) return rej(err);
                res();
            });
        });
        return scriptPath;
    } else if (osCurrent === "win32") {
        const scriptPath = path.join(scriptDir, "launch-server.bat");
        fs.writeFileSync(scriptPath, launchCommand);
        return scriptPath;
    }
}

function getAikarFlags(memGB) {
    const common = [
        '-XX:+UseG1GC',
        '-XX:+ParallelRefProcEnabled',
        '-XX:MaxGCPauseMillis=200',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+DisableExplicitGC',
        '-XX:+AlwaysPreTouch',
        '-XX:G1HeapWastePercent=5',
        '-XX:G1MixedGCCountTarget=4',
        '-XX:G1MixedGCLiveThresholdPercent=90',
        '-XX:G1RSetUpdatingPauseTimePercent=5',
        '-XX:SurvivorRatio=32',
        '-XX:+PerfDisableSharedMem',
        '-XX:MaxTenuringThreshold=1',
        '-Dusing.aikars.flags=https://mcflags.emc.gs',
        '-Dsun.rmi.dgc.server.gcInterval=2147483646',
    ];

    const tierFlags = memGB < 12
        ? [
            '-XX:G1NewSizePercent=30',
            '-XX:G1MaxNewSizePercent=40',
            '-XX:G1HeapRegionSize=8M',
            '-XX:G1ReservePercent=20',
            '-XX:InitiatingHeapOccupancyPercent=15',
        ]
        : [
            '-XX:G1NewSizePercent=40',
            '-XX:G1MaxNewSizePercent=50',
            '-XX:G1HeapRegionSize=16M',
            '-XX:G1ReservePercent=15',
            '-XX:InitiatingHeapOccupancyPercent=20',
        ];

    return [...common, ...tierFlags];
}


async function buildFile(manifest, jreVersion, validRules, gameRules) {
    let CAULDRON_PATH = grabPath();
    let mainClass = manifest.mainClass;
    let javaPath;
    if (osCurrent === "darwin") {
        javaPath = path.join(CAULDRON_PATH, "jvm", jreVersion, "jre.bundle", "Contents", "Home", "bin", "java",);
    } else {
        javaPath = path.join(CAULDRON_PATH, "jvm", jreVersion, "bin", "javaw");
    }

    let launchCommand = `${javaPath} ${validRules.join(" ")} ${mainClass} ${gameRules.join(" ")}`;
    const scriptDir = path.join(CAULDRON_PATH, "scripts");
    fs.mkdirSync(scriptDir, { recursive: true });

    if (osCurrent === "linux" || osCurrent === "darwin") {
        const scriptPath = path.join(scriptDir, "launch.sh");
        fs.writeFileSync(scriptPath, launchCommand);
        await new Promise((res, rej) => {
            exec(`chmod +x "${scriptPath}"`, (err) => {
                if (err) return rej(err);
                res();
            });
        });
        await new Promise((res, rej) => {
            exec(`chmod +x "${javaPath}"`, (err) => {
                if (err) return rej(err);
                res();
            });
        });
        return scriptPath;
    } else if (osCurrent === "win32") {
        const scriptPath = path.join(scriptDir, "launch.bat");
        fs.writeFileSync(scriptPath, launchCommand);
        return scriptPath;
    }
}

module.exports = { buildJVMRules, buildGameRules, buildFile, logInjector, buildLaunchScript };
