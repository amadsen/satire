const Url = require('url');

const recurseForMocks = require('./recurse-for-mocks.js');
const respondWithMocks = require('./respond-with-mocks.js');
const send404 = require('./send-404.js');

function httpServer () {
    const server = http.createServer();
    return {
        server: server,
        init: (config, getMock) => {
            /*
            Set up server
            */
            if (config.port >= 0) {
                server.listen(config.port);
            }
            server.on('listening', ready);
            server.on('request', (req, res) => {
                const url = Url.parse(req.url);
                const mocks = recurseForMocks(url.pathname);
                return respondWithMocks({
                    url,
                    request: req,
                    response: res,
                    mocks
                }) || send404(res);
            });
        }
    };
}

module.exports = httpServer
