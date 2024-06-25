const axios = require('axios');
const jwt = require('jsonwebtoken');
const { cauldronLogger } = require('../tools/logger');
const fs = require('fs');
const path = require('path');

// Verifies that the user owns a valid license of Minecraft

async function verifyMinecraft(access_token) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://api.minecraftservices.com/entitlements/mcstore',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        };
        try {
            const verify = await axios(config)
            var verifyData = verify.data;
            var cert = fs.readFileSync(path.join(__dirname, '../', 'mojang.pem'));  // get public key
            const verified = await jwt.verify(verifyData.signature, cert);
            if (verified) {
                cauldronLogger.info('Minecraft Account Verified')
                resolve(true)
            }
        } catch (err) {
            reject(err)
        };
    })
};

module.exports = { verifyMinecraft };