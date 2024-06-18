const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const homedir = require('os').homedir();
const path = require('path');
const jwt = require('jsonwebtoken');
const { cauldronLogger } = require('../tools/logger');
const { grabPath, getConfig } = require('../tools/compatibility');
var CAULDRON_PATH = grabPath();
const appConfig = getConfig();

// Auth Code Varible (Defaults: unset)
var auth_code = "unset";

// Set Auth Code
function setAuthCode(code) {
    auth_code = code;
};

async function refreshToken(identifier, refresh_token) {
    return new Promise(async (resolve) => {
        let data = qs.stringify({
            'client_id': appConfig.auth.CLIENT_ID,
            'scope': 'XboxLive.signin offline_access',
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        });
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: data
        };
        try {
            const response = await axios(config);
            writeToAuthFile(identifier, { refresh_token: response.data.refresh_token })
            resolve(response.data.access_token);
        } catch (err) {
            (err)
            resolve(false);
        }
    })
}

/*
    Microsoft Authentication Flow:
    https://wiki.vg/Microsoft_Authentication_Scheme
*/

/* Step Zero: Attempt To Refresh Token
    If found skips to step 3
*/
async function attemptToRefresh(identifier) {
    return new Promise(async (resolve) => {
        if (fs.existsSync(path.join(CAULDRON_PATH, 'cauldron_auth.json'))) {
            var fileData = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json')));
            if (fileData.sessions[identifier]) {
                if (fileData.sessions[identifier].refresh_token) {
                    const access_token = refreshToken(identifier, fileData.sessions[identifier].refresh_token)
                    resolve(access_token);
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } else {
            resolve(false);
        };
    })
};


// Step One: Wait For Response
// Waits for auth code to be set
// Repeats Every Second for 30 Seconds

async function waitForResponse() {
    return new Promise(async (resolve) => {
        var MAX_COUNT = 30;
        var count = 0;
        if (auth_code == "unset") {
            var startWaiting = setInterval(async function () {
                if (auth_code != "unset") {
                    var store = auth_code;
                    auth_code = "unset";
                    clearInterval(startWaiting)
                    resolve(store);
                } else if (count >= MAX_COUNT) {
                    clearInterval(startWaiting);
                    throw new Error('NORESPONSE');
                } else {
                    count++;
                }
            }, 1000)
        } else {
            var store = auth_code;
            auth_code = "unset";
            resolve(store);
        }
    });
};

// Step Two: Redeem Token
// Redeems token for access token and refresh token

async function redeemToken(token, identifier) {
    cauldronLogger.info('Redeeming Token From Microsoft');
    let data = qs.stringify({
        'client_id': appConfig.auth.CLIENT_ID,
        'scope': 'XboxLive.signin offline_access',
        'code': token,
        'redirect_uri': appConfig.auth.REDIRECT_URI,
        'grant_type': 'authorization_code',
        'code_verifier': appConfig.auth.VERIFY_CODE
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data
    };
    try {
        const response = await axios(config);
        writeToAuthFile(identifier, { refresh_token: response.data.refresh_token })
        return response.data.access_token;
    } catch (err) {
        throw new Error('REDEEMFAIL')
    };
};

// Step Three: Authenticate with Xbox Live
// Authenticated Access Token with Xbox Live returning details about the user XBLIVE account
async function authenticateXboxLive(access_token) {
    cauldronLogger.info('Authenticating with Xbox Live');
    let data = JSON.stringify({ "Properties": { "AuthMethod": "RPS", "SiteName": "user.auth.xboxlive.com", "RpsTicket": `d=${access_token}` }, "RelyingParty": "http://auth.xboxlive.com", "TokenType": "JWT" });
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://user.auth.xboxlive.com/user/authenticate',
        headers: {
            'Content-Type': 'application/json',
        },
        data: data
    };
    try {
        const authXboxLive = await axios(config);
        return authXboxLive.data;
    } catch (err) {
        (authXboxLiver)
        throw new Error('XBLIVEAUTHFAIL');
    };
};

// Step Four: Authorize with Mojang
// Authroizes the XBLIVE token to access api.minecraftservices.com

async function authorizeMojang(token, email) {
    cauldronLogger.info('Authorizing with Mojang')
    let data = JSON.stringify({ "Properties": { "SandboxId": "RETAIL", "UserTokens": [token] }, "RelyingParty": "rp://api.minecraftservices.com/", "TokenType": "JWT" });
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://xsts.auth.xboxlive.com/xsts/authorize',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };
    try {
        const authMojang = await axios(config);
        writeToAuthFile(email, { xuid: authMojang.data.DisplayClaims.xui[0].uhs });
        return authMojang.data;
    } catch (err) {
        throw new Error('MOJANGFAIL');
    }
};

// Step Five: Authenticate with Minecraft
// Authenticates the current user to api.minecraftservices.com

async function authenticateMinecraft(token, xuid, email) {
    cauldronLogger.info('Authenticating with Minecraft');
    let data = JSON.stringify({
        "identityToken": `XBL3.0 x=${xuid};${token}`
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.minecraftservices.com/authentication/login_with_xbox',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };
    try {
        const mcAuth = await axios(config);
        writeToAuthFile(email, { user_id: mcAuth.data.username, access_token: mcAuth.data.access_token });
        return mcAuth.data;
    } catch (err) {
        throw new Error('MINECRAFTFAIL');
    };
};

//Step Six: Verifies Ownership
// Verifies that the user owns a valid license of Minecraft

async function verifyMinecraft(access_token) {
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
            return true;
        }
    } catch {
        return false;
        throw new Error('NOOWNER');
    };
};

// Step Seven: Get Profile Data
// Retreives Information regarding the user

async function getProfileData(access_token, email) {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://api.minecraftservices.com/minecraft/profile',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    };
    try {
        const profile = await axios(config)
        var profileData = profile.data;
        cauldronLogger.info(`Hello ${profileData.name} UUID: ${profileData.id}`);
        writeToAuthFile(email, { username: profileData.name, uuid: profileData.id });
        return { uuid: profileData.id, username: profileData.name };
    } catch {
        throw new Error('PROFILEGETERROR');
    }
};



// Write to Authentication File

async function writeToAuthFile(identifier, data, clear) {
    var defaultBody = {
        "sessions": {}
    };
    if (!fs.existsSync(path.join(CAULDRON_PATH, 'cauldron_auth.json'))) {
        var defaultBody = {
            "sessions": {}
        };
        fs.writeFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json'), JSON.stringify(defaultBody))
        currentFile = defaultBody;
        currentFile.sessions[identifier] = { ...currentFile.sessions[identifier], ...data };
    } else {
        currentFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json')));
        if (!clear) {
            currentFile.sessions[identifier] = { ...currentFile.sessions[identifier], ...data };
        } else {
            delete currentFile.sessions[identifier];
        }

    };
    fs.writeFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json'), JSON.stringify(currentFile));
};

// Grab Access Token

async function grabAccessToken(email) {

    if (fs.existsSync(path.join(CAULDRON_PATH, 'cauldron_auth.json'))) {
        var auth = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json')));
        if (auth.sessions[email]) {
            return {xui:auth.sessions[email].xuid,user_id:auth.sessions[email].user_id,access_token:auth.sessions[email].access_token };
        }
    };
    return "";
}

module.exports = { setAuthCode, attemptToRefresh, waitForResponse, redeemToken, authenticateXboxLive, authorizeMojang, authenticateMinecraft, verifyMinecraft, getProfileData, writeToAuthFile,grabAccessToken }