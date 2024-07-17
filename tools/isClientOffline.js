const { cauldronLogger } = require("./logger");

var isClientOffline = false;

function isOffline() {
    return isClientOffline;
};

function clientIsOffline() {
    cauldronLogger.info("Client is Offline")
    isClientOffline = true;
};

function clientIsOnline() {
    cauldronLogger.info("Welcome Back! Client Is Online");
    isClientOffline = false;
};

async function checkInternet() {
    return new Promise(async (resolve) => {
        require('dns').lookup('google.com', function (err) {
            if (err && err.code == "ENOTFOUND") {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}


module.exports = { isOffline, clientIsOffline, clientIsOnline, checkInternet };