const { getOperatingSystem, grabPath } = require("./compatibility")
const path = require('path');
const { convertLibraries } = require("./manifestConverter");
const { verifyInstallation } = require("../controllers/queue");
const { validate } = require("./fileTools");
const { execSync, spawn } = require("child_process");
const fs = require('fs');
const JSZip = require('jszip');
const os = require('os')
const { cauldronLogger } = require("./logger");
const readline = require('readline');
const KNOWN_CLIENT_PATCHERS = require('../files/knownClientPatchers.json');
async function postProcessing(CE_OBJECT, side = 'client') {

    return new Promise(async (resolve, reject) => {
        try {
            let CAULDRON_PATH = grabPath();
            let mainClass;
            let returnObj = [];
            let { specName, post, vanillaVersion, loader, jreVersion, lv } = CE_OBJECT;

            let libPath = path.join(CAULDRON_PATH, 'libraries');
            let jarLoc = path.join(CAULDRON_PATH, 'versions', `${specName}`, `${specName}.jar`)

            // Check For Post Processors
            if (post.processors) {
                let processors = post.processors;
                if (processors.length === 0) {
                    resolve(returnObj);
                };

                // Remove Extract Tasks and Filter for correct sides
                const filtered = processors.filter(entry => !hasExtractFilesTask(entry));
                processors = filterProcessors(filtered, side);

                let nonDeclaredLibs = post.libraries;

                // Get and Install Post Proc Libraries
                const { libQueue } = await convertLibraries(nonDeclaredLibs, specName);
                await verifyInstallation(libQueue, false, "Downloading Processor Libraries");

                let forgeData = post.data;


                // Attempt to Find MCP Version (Optional)
                let MCP_VERSION = "";

                if (!forgeData.MCP_VERSION && forgeData.MAPPINGS) {
                    MCP_VERSION = forgeData.MAPPINGS.client
                        .split(`${vanillaVersion}-`)[1]
                        .split(":")[0];
                } else if (forgeData.MCP_VERSION) {
                    MCP_VERSION = forgeData.MCP_VERSION.client.replace(/'/g, "");
                }

                // Generate Params
                let params = {};
                let shaParams = {};

                for (let fIdx in forgeData) {
                    if (fIdx === "MCP_VERSION") {
                        params[fIdx] = MCP_VERSION;
                    } else if (fIdx === "BINPATCH") {
                        params[fIdx] = path.join(libPath, `/net/clients/${specName}`, `${side}.lzma`);
                    } else if (!fIdx.includes("SHA")) {
                        let splitDir = forgeData[fIdx][side]
                            .replace(/[\[\]]/g, "")
                            .split(":");
                        if (fIdx === "MAPPINGS") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}`
                            );
                        } else if (fIdx === "MOJMAPS") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}`
                            );
                        } else if (fIdx === "MERGED_MAPPINGS") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}-merged`
                            );
                        } else if (fIdx === "MC_SRG") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}-srg.jar`
                            );
                        } else if (fIdx === "MC_SLIM") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}-slim.jar`
                            );
                        } else if (fIdx === "MC_EXTRA") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}-extra.jar`
                            );
                        } else if (fIdx === "MC_UNPACKED") {
                            params[fIdx] = path.join(
                                libPath,
                                splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                `${splitDir[1]}-${splitDir[2]}.jar`
                            );
                        } else if (fIdx === "PATCHED") {
                            const classifier = splitDir[3]; // e.g. "client" or undefined
                            if (classifier) {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}-${classifier}.jar`
                                );
                            } else {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}.jar`
                                );
                            }
                        }
                    } else {
                        shaParams[fIdx] = forgeData[fIdx][side].replace(/'/g, "");
                    }
                }

                // Apply Additional Params 
                let mappingsPath;

                switch (loader) {
                    case 'forge':
                        mappingsPath = path.join(libPath, "de/oceanlabs/mcp/mcp_config", `${vanillaVersion}-${MCP_VERSION}`, `mcp_config-${vanillaVersion}-${MCP_VERSION}.zip`,)
                        break;
                    case 'neoforge':
                        mappingsPath = path.join(libPath, "net/neoforged/neoform", `${MCP_VERSION}`, `neoform-${MCP_VERSION}.zip`,);
                        break;
                    default:
                        break;
                }

                params['MAPPING_PATH'] = mappingsPath;
                params['MINECRAFT_JAR'] = jarLoc;
                params['SIDE'] = side;
                params['ROOT'] = path.join(libPath, '../');

                const patchedClientPath = params['PATCHED'];
                const javaDir = getOperatingSystem() === 'osx'
                    ? path.join(CAULDRON_PATH, 'jvm', jreVersion, "jre.bundle/Contents/Home/bin")
                    : path.join(CAULDRON_PATH, 'jvm', jreVersion, "bin")

                const javaEx = path.join(javaDir, 'java');

                // Check Checksums to see if skipping is possible TODO Test validating all
                let checkObjs = [];
                for (let sIdx in shaParams) {
                    if (sIdx === "PATCHED_SHA") {
                        let obj = {
                            destination: path.join(params[sIdx.split("_SHA")[0]], "../"),
                            fileName: path.basename(params[sIdx.split("_SHA")[0]]),
                            sha1: shaParams[sIdx],
                            origin: "none",
                        };
                        checkObjs.push(obj);
                    }
                }

                let checkedFiles = [];
                if (checkObjs.length > 0) {
                    let valid = await validate(checkObjs[0]);
                    if (typeof valid === 'object') {
                        checkedFiles.push(checkObjs[0])
                    }
                };

                let override = false;
                if (loader === 'neoforge') {
                    override = !fs.existsSync(patchedClientPath);
                }
                if (checkedFiles.length !== 0 || override) {
                    cauldronLogger.info(`Starting Post Processing Jobs (${processors.length} Total)`);
                    let count = 1;
                    for (let job of processors) {
                        cauldronLogger.info(`Starting Job ${count} of ${processors.length}`);
                        count++;
                        let selectedProc = job.jar;
                        cauldronLogger.debug(`Process Name : ${selectedProc}`);
                        let splitName = convertNameToPath(selectedProc);
                        let fileName = `${splitName.chunkTwo}-${splitName.chunkThree}`;
                        if (selectedProc.split(":")[3]) {
                            fileName += "-" + selectedProc.split(":")[3];
                        };
                        cauldronLogger.debug(`Normalised To: ${fileName}`);


                        // Extract Main Class From the Manifest File
                        let lPath = path.join(libPath, splitName.chunkOne, splitName.chunkTwo, splitName.chunkThree, `${fileName}.jar`,);
                        const data = fs.readFileSync(lPath)
                        const zip = await JSZip.loadAsync(data);
                        const manifestMf = await zip.files['META-INF/MANIFEST.MF'].async('string');
                        let splitMani = manifestMf.split("\r\n");
                        let mainClass;
                        for (let mIdx in splitMani) {
                            if (splitMani[mIdx].includes("Main-Class")) {
                                mainClass = splitMani[mIdx].split(": ")[1];
                                break;
                            }
                        }
                        cauldronLogger.debug(`Main Class Found: ${mainClass}`)

                        // Generate Class Paths
                        let classPaths = [];
                        for (let cpIdx in job.classpath) {
                            let firstChunk = job.classpath[cpIdx]
                                .split(":")[0]
                                .split(".")
                                .join("/");
                            let secondChunk = job.classpath[cpIdx].split(":")[1];
                            let thirdChunk = job.classpath[cpIdx].split(":")[2];
                            let lPathTemp = path.join(libPath, firstChunk, secondChunk, thirdChunk, `${secondChunk}-${thirdChunk}.jar`,);
                            classPaths.push(lPathTemp);
                        }
                        classPaths.push(lPath)

                        // Create Arguments
                        let actualArgs = job.args.join(" ");
                        let classPathSep;
                        let osCurrent = getOperatingSystem();
                        if (osCurrent === "windows") {
                            classPathSep = ";";
                        } else {
                            classPathSep = ":";
                        };

                        // Build Commnad
                        let command = `-cp ${classPaths.join(classPathSep)} ${mainClass} ${actualArgs}`

                        // Replace Mappings Path
                        if (forgeData.MAPPINGS) {
                            command = command.replace(forgeData.MAPPINGS.server.replace(":mappings@txt", "@zip"), "{MAPPING_PATH}",);
                            command = command.replace(forgeData.MAPPINGS.server.replace(":mappings@tsrg", "@zip"), "{MAPPING_PATH}",);
                        };

                        // Inject Parameters 
                        command = injector.create(command, params)

                        try {
                            if (KNOWN_CLIENT_PATCHERS.includes(mainClass) && loader == 'forge') {
                                let clientPath = path.join(CAULDRON_PATH, 'libraries', 'net/minecraftforge/forge', `${vanillaVersion}-${lv}`, `forge-${vanillaVersion}-${lv}-client.jar`);
                                cauldronLogger.debug(`Patched Client`)
                                fs.writeFileSync(path.join(CAULDRON_PATH, "versions", `forge-${vanillaVersion}-${lv}`, `forge-${vanillaVersion}-${lv}-patch.json`), JSON.stringify([clientPath], null, 2));
                                returnObj.push(clientPath)
                            };
                            cauldronLogger.debug(`${javaEx} ${command}`)
                            await run(`${javaEx} ${command}`, cauldronLogger);

                            //cauldronLogger.debug(result.toString());



                        } catch (e) {
                            if (vanillaVersion === '1.14.3') {
                                cauldronLogger.debug('Skipping Post Processer (Known Error)');
                            } else {
                                cauldronLogger.debug('STDOUT:', e.stdout?.toString());
                                cauldronLogger.debug('STDERR:', e.stderr?.toString());
                                reject(e);
                            }
                        }


                    };

                    if (loader === 'neoforge') {
                        if (patchedClientPath && fs.existsSync(patchedClientPath)) {
                            addManifestToJar(patchedClientPath, javaDir);
                        }
                    }

                    cauldronLogger.info('Finished Post Processing Jobs')
                    resolve(returnObj);


                } else {
                    // Processors are Skipped then add the manifest to the existing client jar
                    if (loader === 'neoforge') {
                        if (patchedClientPath && fs.existsSync(patchedClientPath)) {
                            addManifestToJar(patchedClientPath, javaDir);
                        };
                    } else if (loader === 'forge') {
                        let potPatchFile = path.join(CAULDRON_PATH, 'versions', specName, `${specName}-patch.json`)
                        let checkForPatchFile = fs.existsSync(potPatchFile)
                        if (checkForPatchFile) {
                            let patch = JSON.parse(fs.readFileSync(potPatchFile).toString());
                            returnObj = [...returnObj, ...patch]
                        }
                    }

                    cauldronLogger.info('Skipped Post Processing Jobs');
                    resolve(returnObj);
                    return;
                }

            } else {
                resolve(returnObj);
            }



        } catch (e) {
            reject(e)
        }
    })
}

// Tools

// BEP Filter
function hasExtractFilesTask(entry) {
    if (!Array.isArray(entry.args)) return false;
    const taskIndex = entry.args.indexOf('--task');
    if (taskIndex === -1) return false;
    return entry.args[taskIndex + 1] === 'EXTRACT_FILES';
}

// Side Filterer
const filterProcessors = (processors, side) =>
    processors.filter(p => !Array.isArray(p.sides) || p.sides.includes(side));

// Manifest Inserter
function addManifestToJar(jarPath, javaDir) {
    const jarTool = path.join(javaDir, "jar");
    const osCurrent = os.platform();
    const manifestContent = "Manifest-Version: 1.0\nAutomatic-Module-Name: minecraft\n\n";
    fs.mkdirSync(path.join(grabPath(),'.temp'))
    const manifestPath = path.join(grabPath(), '.temp', 'cauldron_manifest.mf')
    fs.writeFileSync(manifestPath, manifestContent);
    try {
        if (osCurrent === "linux" || osCurrent === "darwin") {
            execSync(`chmod +x "${jarTool}"`);
        }
        execSync(`"${jarTool}" --update --file="${jarPath}" --manifest="${manifestPath}"`, { stdio: 'pipe' });
    } catch (e) {
        console.error('addManifestToJar ERROR:', e.message);
        console.error('stderr:', e.stderr?.toString());
    } finally {
        if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    }
}

// Converts MC Name to Useful Chunks
function convertNameToPath(name) {
    let split = name.split(":");
    let chunkOne = split[0].split(".").join("/");
    let chunkTwo = split[1];
    let chunkThree = split[2];
    return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
}

//Variable Injector
let injector = {
    create: (function () {
        let regexp = /\{([^{]+)}/g;
        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? "" : key;
            });
        };
    })(),
};

// Runner
function run(cmd, logger) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, { shell: true });
        const lines = [];

        readline.createInterface({ input: child.stdout }).on('line', (line) => {
            lines.push(line);
            logger.debug(line);
        });

        readline.createInterface({ input: child.stderr }).on('line', (line) => {
            lines.push(line);
            logger.error(line);
        });

        child.on('error', reject);
        child.on('close', (code) => {
            const output = lines.join('\n');
            code === 0
                ? resolve(output)
                : reject(Object.assign(new Error(`"${cmd}" exited with ${code}`), { code, output }));
        });
    });
}

module.exports = { postProcessing }