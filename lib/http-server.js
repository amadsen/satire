const Url = require('url');
const http = require('http');
const uuid = require('uuid');

const recurseForMocks = require('./recurse-for-mocks.js');
const respondWithMocks = require('./respond-with-mocks.js');
const proxyAPI = require('./proxy-api.js');
const send404 = require('./send-404.js');

function httpServer () {
    const server = http.createServer();

    let initialized = false;
    let shutdown = false;

    server.on('shutdown', () => {
        shutdown = true;
        const fn = (initialized) ?
            setImmediate :
            (handler) => server.on('initialized', handler);
        
        fn(() => {
            server.emit('_shutdown');
        });
    });

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
                const mocks = [
                    ...recurseForMocks(getMock, url.pathname),
                    { mock: proxyRequest.bind(null, { correlationId }) },
                    { mock: send404 }
                ];

                return respondWithMocks({
                    url,
                    request: req,
                    response: res,
                    mocks
                });
            });

            setImmediate(() => {
                server.emit('initialized');
            });
            initialized = true;

            server.on('listening', () => {
                const fn = (shutdown) ?
                    setImmediate :
                    (handler) => server.on('_shutdown', handler);
                fn(() => server.close());
            });

            return Promise.resolve(config);
        }
    };
}

module.exports = httpServer
