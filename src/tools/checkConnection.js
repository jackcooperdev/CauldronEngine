import dns from "dns";

async function checkInternet() {
    return new Promise(async (resolve) => {
        dns.lookup("google.com", function (err) {
            if (err && err.code === "ENOTFOUND") {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

export {checkInternet};
