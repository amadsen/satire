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
    watch: true,
    logger: console
};

function normalizeMocks(config) {
    try {
        return Object.assign(config, {
            mocks: [].concat(
                typeof config.mocks === 'string' ?
                    JSON.parse(config.mocks) :
                    config.mocks
            )
        });
    } catch(e) {
        return Promise.reject(new Error(`Invalid mocks configuration: '${config.mocks}'`));
    }
}

function satire({ argv, settings, name }) {
    const mockServer = httpServer();
    /*
    Get config
    */
    configr8({
        name: name || 'satire',
        useEnv: true,
        useArgv: !(false === argv),
        usePkg: true,
        async: true
    })(defaultSettings, settings)
    .then(normalizeMocks)
    .then((config) => {
        mockServer.server.emit('config', config);
        return Object.assign(config, {
            emit: (...args) => mockServer.server.emit(...args),
            on: (...args) => mockServer.server.on(...args)
        });
    })
    .then(watchMocks)
    .then(mockServer.init)
    .then((config) => {
        if (typeof config.port === 'number' && config.port >= 0) {
            return new Promise((resolve) => {
                mockServer.server.listen(config.port, () => {
                    // NOTE: We don't bother to check for an error
                    // in this callback because we would just use
                    // it to reject this promise - which would then,
                    // in turn, emit('error', ...) the error on the
                    // server - which is what happens anyway
                    return resolve();
                });
            });
        }
    })
    .catch((err) => {
        mockServer.server.emit('error', err);
    });

    return mockServer.server;
}

module.exports = satire;

if (module === process.mainModule) {
    // if we were started directly, treat it as though
    // we were started via the CLI
    require('./cli/satire.js');
}
