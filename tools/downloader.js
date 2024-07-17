const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const axios = require('axios')
const crypto = require('crypto');
const shelljs = require('shelljs');
const path = require('path');
const { grabPath } = require('../tools/compatibility');
const { isOffline } = require("./isClientOffline");
const { cauldronLogger } = require("./logger");

async function download(url, location, fileName) {
    return new Promise(async (resolve) => {
        //Wrapping the code with an async function, just for the sake of example.
        if (url == "no file") {
            resolve("NOFILE")
        } else {
            if (!isOffline()){
                const downloader = new Downloader({
                    url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
                    directory: location, //This folder will be created, if it doesn't exist.   
                    cloneFiles: false,
                    fileName: fileName
                });
                try {
                    const { filePath, downloadStatus } = await downloader.download(); //Downloader.download() resolves with some useful properties.
                    resolve(true);
                } catch (error) {
                    console.log(error.message)
                    console.log(url)
                    //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
                    //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
                    resolve(false);
                };
            } else {
                resolve(true);
            }
        };
    });
};

//Grab Main Manifest and Download / Store

async function downloadVersionManifests(manifestUrl, save, dir, id) {
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {
            var config = {
                method: 'get',
                url: manifestUrl
            };
            const getManifest = await axios(config);
            if (save && !dir) {
                local_manifest = getManifest.data;
                fs.writeFileSync(path.join(CAULDRON_PATH, 'cauldron_version_manifest.json'), JSON.stringify(local_manifest))
                resolve(local_manifest)
            } else if (save && dir) {
                shelljs.mkdir('-p', path.join(CAULDRON_PATH, dir));
                fs.writeFileSync(path.join(CAULDRON_PATH, dir, `${id}.json`), JSON.stringify(getManifest.data));
            };
            resolve(getManifest.data)
        } catch (err) {
            if (isOffline()) {
                if (manifestUrl == 'https://launchermeta.mojang.com/mc/game/version_manifest.json') {
                    //cauldronLogger.warn("Client is Offline! Using saved copy of Version Manifest!");
                    var savedManifest = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'cauldron_version_manifest.json')));
                    resolve(savedManifest);
                } else {
                    console.log(manifestUrl)
                    console.log(id)
                    if (id.includes('java') || id.includes('jvm') || id.includes('jre')) {
                        console.log('jaba')
                            var specVersionMani = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'jvm',id+'.json' )));
                            resolve(specVersionMani)
                        
                    } else {
                        var specVersionMani = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'versions', manifestUrl.split("/").pop().split(".json")[0], manifestUrl.split("/").pop())));
                        resolve(specVersionMani);
                    }


                }

            } else {
                reject('Version Does Not Exist')
            }

        }
    })
};


async function extract(filePath) {
    return new Promise(async (resolve) => {
        try {
            var input = fs.readFileSync(filePath);
        } catch (err) {
            (filePath)
        };
        try {
            const decompress = await lzma.decompress(input);
            const writeFile = fs.writeFileSync(filePath, decompress)
            resolve(true);
        } catch (err) {
            console.log(err)
            if (filePath == 'no path') {
                resolve(true)
            } else {
                resolve(false);
            };
        }

    })
};

async function validate(file) {
    return new Promise(async (resolve) => {
        if (file.destination == 'no path') {
            resolve(true);
        } else {
            if (fs.existsSync(path.join(file.destination, file.fileName))) {
                var fileFound = fs.readFileSync(path.join(file.destination, file.fileName));
                var sha1sum = crypto.createHash('sha1').update(fileFound).digest("hex");
                if (sha1sum != file.sha1) {
                    if (file.sha1 == 'NONE') {
                        resolve(true);
                    } else {

                        resolve(file);
                    }
                } else {
                    resolve(true)
                }
            } else {
                resolve(file)
            };
        };
    });
};

module.exports = { download, extract, validate, downloadVersionManifests };