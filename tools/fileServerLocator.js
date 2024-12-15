const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const FILE_SERVER_KEY =  fs.readFileSync(path.join(__dirname, '../', 'files', 'file.key.pub')).toString();
const DEFAULT_FILES_LOCATION = "https://files.cauldronmc.com";

async function grabStaticFileServer() {
    return new Promise(async (resolve, reject) => {
        let FILE_SERVER_LOCATION = DEFAULT_FILES_LOCATION;
        if (process.env.CAULDRON_STATIC) {
           FILE_SERVER_LOCATION = process.env.CAULDRON_STATIC;
        }

        let config = {
            method:'get',
            url: `${FILE_SERVER_LOCATION}/verify`,
        }
        try {
            const response = await axios(config);
            let verificationKey = response.data;
            let keyData;
            keyData = jwt.verify(verificationKey, FILE_SERVER_KEY);
            /**
             * @param keyData          Information about the object.
             * @param keyData.domain   Information about the object's members.
             */

            if (keyData.domain !== FILE_SERVER_LOCATION) {
                reject('FILE_SERVER_INVALID');
            }

            resolve(FILE_SERVER_LOCATION)
        } catch (e) {
            reject('FILE_SERVER_INVALID');
        }

    })

}

module.exports = {grabStaticFileServer};