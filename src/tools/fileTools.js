const Downloader = require("nodejs-file-downloader");
const fs = require("fs");
const path = require("path");
const checksum = require("checksum");
const { checkInternet } = require("./checkConnection.js");
const crypto = require('crypto')
const RESOURCES_PATH = process.env.RESOURCE_SERVER || "https://resources.cauldronmc.com"

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


async function download(url, location, fileName) {
    return new Promise(async (resolve) => {
        if (await checkInternet()) {
            url = injector.create(url,{resourcePath:RESOURCES_PATH})
            const downloader = new Downloader({
                url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
                directory: location, //This folder will be created if it doesn't exist.
                cloneFiles: false, fileName: fileName, maxAttempts: 50,
            });
            try {
                await downloader.download(); //Downloader.download() resolves with some useful properties.
                resolve(true);
            } catch (error) {
                //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
                //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
                resolve(false);
            }
        } else {
            resolve(true);
        }
    });
}
function createUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),);
}
async function validate(file) {
    return new Promise(async (resolve) => {
        if (file.destination === "no path") {
            resolve("pass");
            return;
        }
        if (file.sha1 === "NONE" && fs.existsSync(path.join(file.destination, file.fileName))) {
            resolve("pass");
            return;
        }
        checksum.file(path.join(file.destination, file.fileName), function (err, sum) {
            if (sum === file.sha1) {
                resolve(true);
            } else {
                resolve(file);
            }
        },);
    });
}

module.exports = { download, validate, createUUID };
