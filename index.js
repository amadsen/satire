/*
+ emits events when requests are received and responses are sent
+ file-based responses (particularly for GET requests)
+ other HTTP methods supported through modules
+ auto-reload when mock files change
+ optional proxy to actual APIs
*/

const configr8 = require('configr8');

const watchMocks = require('./lib/watch-mocks.js');
const httpServer = require('./lib/http-server');

const defaultSettings = {
    port: 0,
    mocks: [
        './mocks/**/*',
        './test/mocks/**/*'
    ],
    logger: console
}

function satire({ argv, settings }) {
    const server = httpServer();
    /*
    Get config
    */
    configr8({
        name: 'satire',
        useEnv: true,
        useArgv: !(false === argv || Array.isArray(argv)),
        usePkg: true,
        async: true
    })(defaultSettings, settings)
    .then((config) => {
        server.server.emit('config', config);
        return Object.assign(config, { emit: (...args) => server.server.emit(...args) })
    })
    .then(watchMocks)
    .then(server.init)
    .catch((err) => {
        setImmediate(server.server.emit, 'error', err);
    });

    return server.server;
}

module.exports = satire;

if (module === process.mainModule) {
    // if we were started directly, treat it as though
    // we were started via the CLI
    require('./cli/satire.js');
}
