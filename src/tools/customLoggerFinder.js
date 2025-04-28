import axios from "axios";
import {grabStaticFileServer} from "./fileServerLocator.js";

async function findCustomLogger(loggerIdx) {
    return new Promise(async (resolve) => {
        try {
            let predictedPath = `${await grabStaticFileServer()}/logs/${loggerIdx}`;

            let config = {
                method: "HEAD",
                url: predictedPath,
            };

            await axios(config);
            resolve(true);
        } catch (e) {
            resolve(false);
        }
    });
}

export {findCustomLogger};
