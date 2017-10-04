const Url = require('url');
const http = require('http');
const uuid = require('uuid');

const recurseForMocks = require('./recurse-for-mocks.js');
const respondWithMocks = require('./respond-with-mocks.js');
const proxyAPI = require('./proxy-api.js');
const send404 = require('./send-404.js');

function httpServer () {
    const server = http.createServer();
    return {
        server: server,
        init: ({ config, getMock }) => {
            const proxyRequest = proxyAPI(config);
            /*
            Set up server
            */
            server.on('request', (req, res) => {
                const correlationId = uuid.v4();
                server.emit('mock-start', {
                    correlationId,
                    req,
                    res
                });
                const resEndHandler = (type) => () => {
                    res.emit('mock-end', {
                        type,
                        correlationId,
                        req,
                        res
                    });
                };
                res.on('close', resEndHandler('close'));
                res.on('finish', resEndHandler('finish'));

                const url = Url.parse(req.url);
                const mocks = recurseForMocks(getMock, url.pathname);
                return respondWithMocks({
                    url,
                    request: req,
                    response: res,
                    mocks
                }) || proxyRequest(req, res, { correlationId }) || send404(res);
            });

            if (config.port >= 0) {
                return new Promise((resolve, reject) => {
                    server.listen(config.port, (err) => {
                        return (err) ? reject(err) : resolve();
                    });
                });
            }

            return Promise.resolve();
        }
    };
}

module.exports = httpServer
