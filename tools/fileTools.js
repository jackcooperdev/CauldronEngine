const Downloader = require("nodejs-file-downloader");
const fs = require('fs')
const path = require('path');

let checksum = require('checksum');
const {checkInternet} = require("./checkConnection");


async function download(url, location, fileName) {
    return new Promise(async (resolve) => {
        //Wrapping the code with an async function, just for the sake of example.
        if (url === "no file") {
            resolve("NOFILE")
        } else {
            if (await checkInternet()) {
                    const downloader = new Downloader({
                    url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
                    directory: location, //This folder will be created, if it doesn't exist.   
                    cloneFiles: false,
                    fileName: fileName,
                    maxAttempts:10
                });
                try {
                    await downloader.download(); //Downloader.download() resolves with some useful properties.
                    resolve(true);
                } catch (error) {
                    console.log(error)
                    //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
                    //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
                    resolve(false);
                }
            } else {
                resolve(true);
            }
        }
    });
}




async function validate(file) {
    return new Promise(async (resolve) => {
        if (file.destination === 'no path') {
            resolve('pass');
            return;
        }
        if (file.sha1 === 'NONE' && fs.existsSync(path.join(file.destination, file.fileName))) {
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
}

module.exports = { download, validate };