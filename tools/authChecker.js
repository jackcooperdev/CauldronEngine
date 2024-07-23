const axios = require('axios');
const jwt = require('jsonwebtoken');
const { cauldronLogger } = require('../tools/logger');
const fs = require('fs');
const path = require('path');
const {checkInternet } = require('./isClientOffline');

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
            } else {
                resolve(false);
            }
        } catch (err) {
            if (err.code) {
                if (err.code == 'ENOTFOUND') {
                    //Assume Offline
                    // Sets Client to Offline
                    cauldronLogger.warn("Error Communicating with MinecraftServices!");
                    cauldronLogger.warn("Is Client Offline?");
                    if (!checkInternet()) {
                        cauldronLogger.warn("Confirmed Client is Offline");
                        cauldronLogger.warn("Skipping step be warned client may not be authenticated!");
                        resolve(true);
                    } else {
                        cauldronLogger.error("Client is Not Offline! Skipping Still!");
                        resolve(true)
                    }
                    
                } else {
                    resolve(false)
                }
            };
            resolve(true);
        };
    })
};

module.exports = { verifyMinecraft };