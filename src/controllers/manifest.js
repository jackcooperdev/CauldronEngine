// noinspection JSUnusedGlobalSymbols,JSUnresolvedReference

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os");
// Import Tools
const { grabPath } = require("../tools/compatibility.js");
const {
    addOSSpecArguments,
    convertAssets,
    convertLegacyAssets,
    convertPre16Assets,
} = require("../tools/manifestConverter.js");
const { cauldronLogger } = require("../tools/logger.js");
const { checkInternet } = require("../tools/checkConnection.js");
const { checkCompat } = require("./jvm.js");
const {getOperatingSystem} = require("../tools/compatibility");

const osCurrent = os.platform();
const RESOURCES_PATH = "https://resources.cauldronmc.com";

async function checkManifest(fileName, url, type) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, fileName)).toString());
            if (isOnline && type === "main") {
                await downloadManifest(url, path.join(CAULDRON_PATH, fileName));
            }
            resolve(expected);
        } catch (err) {
            cauldronLogger.debug(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), type);
                    resolve(downloadedFile);
                } catch (err) {
                    console.log(err);
                }
            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`);
            }
        }
    });
}

async function checkJAR(fileName, url) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = fs.readFileSync(path.join(CAULDRON_PATH, fileName));
            resolve(expected);
        } catch (err) {
            if (isOnline) {
                try {
                    const downloadedFile = await downloadALL(url, path.join(CAULDRON_PATH, fileName));
                    resolve(downloadedFile);
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`);
            }
        }
    });
}

async function downloadALL(url, dir) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: "get",
            url: url,
            responseType: "arraybuffer",
        };
        try {
            const file = await axios(config);
            fs.mkdirSync(path.dirname(dir), { recursive: true });
            fs.writeFileSync(dir, file.data);
            resolve(file.data);
        } catch (err) {
            reject(err.message);
        }
    });
}

async function checkLog(fileName, url) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        if (isOnline) {
            try {
                const downloadedFile = await downloadALL(url, path.join(CAULDRON_PATH, fileName));
                resolve(downloadedFile);
            } catch (err) {
                reject(err);
            }
        }
    });
}

let convertManifests = {
    assets: convertAssets,
    legacy: convertLegacyAssets,
    "pre-1.6": convertPre16Assets,
};

async function downloadManifest(url, dir, type) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: "get",
            url: url,
        };
        try {
            const file = await axios(config);
            fs.mkdirSync(path.dirname(dir), { recursive: true });
            let fileData = file.data;
            if (convertManifests[type]) {
                fileData = await convertManifests[type](fileData);
            }
            fs.writeFileSync(dir, JSON.stringify(fileData, null, 2));
            resolve(fileData);
        } catch (err) {
            reject(err.message);
        }
    });
}

async function getPackwizJVM() {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        if (!fs.existsSync(path.join(CAULDRON_PATH, "config", "jvm_installed.json"))) {
            fs.mkdirSync(path.join(CAULDRON_PATH, "config"), { recursive: true });
            fs.writeFileSync(path.join(CAULDRON_PATH, "config", "jvm_installed.json"), "{}");
        }
        try {
            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json");
            const jvmCompat = await checkCompat("java-runtime-alpha", jvmMeta);
            if (!jvmCompat) {
                return reject("Version Not Supported on " + osCurrent);
            }
            const jvmMani = await checkManifest(path.join("jvm", "java-runtime-alpha.json"), jvmCompat[0].manifest.url);
            resolve({ jvmMeta, jvmMani, jvmComp: "java-runtime-alpha" });
        } catch (err) {
            reject(err);
        }
    });
}

async function getManifests(v, l, lv) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            fs.mkdirSync(path.join(CAULDRON_PATH, "config"), { recursive: true });

            const ensureFile = (filePath) => {
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, "{}");
                }
            };

            ensureFile(path.join(CAULDRON_PATH, "config/assets_installed.json"));
            ensureFile(path.join(CAULDRON_PATH, "config/jvm_installed.json"));
            ensureFile(path.join(CAULDRON_PATH, "config/libs_installed.json"));

            const assetDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json")).toString());
            const jvmDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json")).toString());
            const libDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/libs_installed.json")).toString());

            let manifest, vanillaManifest;

            if (l !== "vanilla") {
                manifest = await checkManifest(`cauldron_${l}_version_manifest.json`, `${RESOURCES_PATH}/loaders/${l}/version_manifest.json`, "main");
                vanillaManifest = await checkManifest("cauldron_version_manifest.json", `${RESOURCES_PATH}/version_manifest.json`, "main");
            } else {
                manifest = vanillaManifest = await checkManifest("cauldron_version_manifest.json", `${RESOURCES_PATH}/version_manifest.json`, "main");
            }

            v = await whatIsThis(v, vanillaManifest);

            const foundVersionData = manifest.versions.find((version) => version.id === v);
            if (!foundVersionData) {
                return reject({ message: `Version not ${l === "vanilla" ? "found" : `supported for loader: ${l}`}` });
            }

            lv = foundVersionData.loaderVersion || manifest.version;

            let specLocation = l !== "vanilla" ? `${l}-${v}-${lv}` : v;
            const getSpec = await checkManifest(path.join("versions", specLocation, `${specLocation}.json`), foundVersionData.url, "spec");
            const createdManifest = await addOSSpecArguments(getSpec);

            if (createdManifest.logging) {
                const logFile = createdManifest.logging.client.file;
                const logPath = path.join(CAULDRON_PATH, "assets", "log_configs", logFile.id);
                if (!fs.existsSync(logPath)) {
                    await checkLog(path.join("assets", "log_configs", logFile.id), logFile.url);
                }
            }

            await checkJAR(path.join("versions", createdManifest.id, `${createdManifest.id}.jar`), createdManifest.downloads.client.url);

            const ids = createdManifest.libraries.map((lib) => lib.name);
            createdManifest.libraries = createdManifest.libraries.filter(({ name }, index) => !ids.includes(name, index + 1));

            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json", "java");
            const jvmCompat = await checkCompat(createdManifest.javaVersion.component, jvmMeta);
            if (!jvmCompat) return reject("Version Not Supported on " + osCurrent);
            const jvmMani = await checkManifest(path.join("jvm", `${createdManifest.javaVersion.component}.json`), jvmCompat[0].manifest.url, "java");

            const assetMani = await checkManifest(path.join("assets", "indexes", `${createdManifest.assets}.json`), createdManifest.assetIndex.url, "assetIndex");
            const assetType = ["legacy", "pre-1.6"].includes(createdManifest.assets) ? createdManifest.assets : "assets";
            const assetsConverted = await checkManifest(path.join("assets", "indexes", `${createdManifest.assets}-cauldron.json`), createdManifest.assetIndex.url, assetType);

            let postData = null;
            if (createdManifest.requiresPost) {
                postData = await checkManifest(path.join("versions", specLocation, "post.json"), `${RESOURCES_PATH}/loaders/${l}/${v}-${lv}/post.json`, "spec");
            }

            const allManifests = {
                spec: createdManifest,
                jvmMani,
                jvmComp: createdManifest.javaVersion.component,
                assets: assetMani,
                assetsInfo: assetsConverted,
                version: v,
                versionData: { loader: l, version: v, loaderVersion: lv },
                loader: l,
                assetsDownloaded: !!assetDict[createdManifest.assets],
                jvmDownloaded: !!jvmDict[createdManifest.javaVersion.component],
                libsDownloaded: !!libDict[createdManifest.id],
                loaderVersion: lv,
                needsPost: createdManifest.requiresPost,
                postData,
            };

            resolve(allManifests);
        } catch (err) {
            console.error(err);
            process.exit(0);
            reject(err);
        }
    });
}

async function whatIsThis(version, vanillaManifest) {
    if (version === "release" || version === "latest") {
        return vanillaManifest.latest.release;
    } else if (version === "snapshot") {
        return vanillaManifest.latest.snapshot;
    } else {
        return version;
    }
}

module.exports =  { getManifests, getPackwizJVM, checkManifest, whatIsThis };
