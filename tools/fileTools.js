const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
var lzma = require('lzma-native');
const axios = require('axios')
const crypto = require('crypto');
const shelljs = require('shelljs');
const path = require('path');
const { grabPath } = require('./compatibility');
const { isOffline, checkInternet } = require("./checkConnection");
const { cauldronLogger } = require("./logger");
var checksum = require('checksum')
    , cs = checksum('sha1')

async function download(url, location, fileName) {
    return new Promise(async (resolve) => {
        //Wrapping the code with an async function, just for the sake of example.
        if (url == "no file") {
            resolve("NOFILE")
        } else {
            if (checkInternet()) {
                    const downloader = new Downloader({
                    url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
                    directory: location, //This folder will be created, if it doesn't exist.   
                    cloneFiles: false,
                    fileName: fileName,
                    maxAttempts:10
                });
                try {
                    const { filePath, downloadStatus } = await downloader.download(); //Downloader.download() resolves with some useful properties.
                    resolve(true);
                } catch (error) {
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
            resolve('pass');
            return;
        };
        if (file.sha1 == 'NONE' && fs.existsSync(path.join(file.destination, file.fileName))) {
            resolve('pass');
            return;
        }
        checksum.file(path.join(file.destination, file.fileName), function (err, sum) {
            if (sum === file.sha1) {
                resolve(true);
            } else {
                resolve(file);
            }
        })
    });
};

module.exports = { download, extract, validate };