const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { grabPath, getOperatingSystem } = require("./compatibility.js");
const { jwtDecode } = require("jwt-decode");
const pkgJSON = require('../../package.json')


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
        let writeToPath = path.join(CAULDRON_PATH, '.temp', 'log_config.xml')

        fs.writeFileSync(writeToPath, logFileCont);
    } catch (e) {
        fs.mkdirSync(path.join(logFile, "../"), { recursive: true });
        fs.writeFileSync(path.join(logFile, "../", "log_config.xml"), "");
    }
}

async function buildJVMRules(manifest, libraryList, versionData, overrides, useLegacyFix) {
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
        } else if (vArray.includes(versionData.version) || versionData.version.startsWith(vArray) || vArray.filter(v => versionData.version.includes(v))) {
            proxyPort = 11707;
        }
        //process.exit(0)
        if (proxyPort) {
            //validRules.push("-Dhttp.proxyHost=betacraft.uk");
            //validRules.push("-Dhttp.proxyPort=" + proxyPort);
        }


        let nativesPath = path.join(CAULDRON_PATH, '.temp')
        let logPath = path.join(CAULDRON_PATH, ".temp", "log_config.xml")



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
            natives_directory: nativesPath,
            assets_root: path.join(CAULDRON_PATH, "assets"),
            launcher_name: cusJVM.launcher_name,
            version_name: manifest.id,
            launcher_version: pkgJSON.version,
            client_jar: path.join(CAULDRON_PATH, "versions", manifest.id, manifest.id + ".jar",),
            classpath: classPath,
            path: logPath,
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

        if (useLegacyFix) {
            validRules.push('-javaagent:' + path.join(CAULDRON_PATH, '.temp', 'legacyfix.jar'));
            if (useLegacyFix === 2) {
                validRules.push('-Djava.util.Arrays.useLegacyMergeSort=true')
            }
        }
        resolve(validRules);
    });
}

async function buildGameRules(manifest, loggedUser, overrides) {
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

        let demoMode = false;
        let gameVars = {
            username: 'Demo',
            version_type: manifest.type,
            game_directory: CAULDRON_PATH,
            server_ip: "",
            uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
            xuid: 'none',
            clientId: 'none',
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30'
        };
        if (typeof loggedUser === "object") {
            if (loggedUser.demo) {
                demoMode = false; // Change Before Release
            } else {
                gameVars.access_token = loggedUser.token;
                gameVars.username = loggedUser.accountData.pfd[0].name;
                gameVars.uuid = loggedUser.accountData.pfd[0].id;
                gameVars.xuid = loggedUser.accountData.xuid
                gameVars.clientId = loggedUser.accountData.sub
            }
        } else {
            let decodedToken = jwtDecode(loggedUser)
            gameVars.access_token = loggedUser
            if (decodedToken.pfd) {
                gameVars.username = decodedToken.pfd[0].name;
                gameVars.uuid = decodedToken.pfd[0].id;
                gameVars.xuid = decodedToken.xuid
                gameVars.clientId = decodedToken.sub
            }
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
            profile_name:'Minecraft',
            auth_access_token: gameVars.access_token,
            CLIENT_ID: gameVars.clientId,
            game_assets: path.join(CAULDRON_PATH, "resources"),
            auth_xuid: gameVars.xuid,
            resolution_width: 854,
            resolution_height: 480,
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

        if (demoMode) {
            gameRules.push('--demo')
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
const quote = (a) => /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;

// Keep "-cp <path>" and "--flag <value>" on one line; everything else gets its own line
function pairArgs(args) {
    const lines = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i], next = args[i + 1];
        const takesValue = a === "-cp" || a === "-classpath" || a.startsWith("--");
        if (takesValue && next !== undefined && !next.startsWith("--")) { lines.push([a, next]); i++; }
        else lines.push([a]);
    }
    return lines;
}

function formatLaunchCommand(javaPath, jvmArgs, mainClass, gameArgs) {
    const line = (parts) => parts.map(quote).join(" ");
    return [
        quote(javaPath),
        ...pairArgs(jvmArgs).map((l) => "  " + line(l)),
        "  " + mainClass,
        ...pairArgs(gameArgs).map((l) => "  " + line(l)),
    ].join(" \\\n");
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
    let launchCommand;

    if (osCurrent === 'darwin') {
        launchCommand = formatLaunchCommand(javaPath, validRules, mainClass, gameRules);
    } else {
        launchCommand = `${javaPath} ${validRules.join(" ")} ${mainClass} ${gameRules.join(" ")}`;
    }
    const scriptDir = path.join(CAULDRON_PATH, ".temp");
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
