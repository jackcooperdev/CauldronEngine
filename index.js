const auth = require('./controllers/auth');



async function startCodeFlow() {

}

function setAuthCode(code) {
    auth.setAuthCode(code);
};

//module.exports = { setAuthCode }