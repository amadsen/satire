/*
+ emits events when requests are received and responses are sent
+ file-based responses (particularly for GET requests)
+ other HTTP methods supported through modules
+ auto-reload when mock files change
+ optional proxy to actual APIs
*/

const configr8 = require('configr8');
const type = require('type-of');

const prepMocks = require('./lib/prepare-mocks.js');
const httpServer = require('./lib/http-server');
const callingFile = require('calling-file');
const mayRequire = require('may-require');

const defaultSettings = {
    port: 0,
    mocks: [
        './mocks/**/*',
        './test/mocks/**/*'
    ],
    watch: true
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
        throw new Error(`Invalid mocks configuration: '${config.mocks}'`);
    }
}

const watchTypes = {
    // explicitly treat null and undefined as false
    null: () => false,
    undefined: () => false,
    // config.watch may be a function
    function: (w) => w,
    object: (w) => {
        // or an object with module and args
        const [err, watcher] = mayRequire({
            /*
            Require in the context of the file that called
            satire UNLESS it is the satire CLI.
            */
            from: callingFile({
                dir: true,
                ignore: [require.resolve('./cli/satire.js')]
            }) || process.cwd()
        })(w.module);

        if(err) {
            // optional require let us specifify a "from" directory
            throw err;
        }

        return watcher(...w.args);
    },
    string: (w) => watchTypes.object({ module: w }),
    boolean: (w) => {
        // or true, indicating the default watchers
        if (w === true) {
            const [e1, nsfw] = mayRequire('./lib/watchers/nsfw.js');
            const [e2, chokidar] = mayRequire('./lib/watchers/chokidar.js');
            const watcher = nsfw || chokidar;
            if (!watcher) {
                let err = new Error('Unable to provide a default file watcher.');
                err.chain = [e1, e2];
                throw err;
            }
            return watcher;
        }
        // false means no watchers
        return false;
    },
    throws: (w) => {
        throw new Error(`Unsupported watch configuration: ${watch}`);
    }
};

function normalizeWatch(config) {
    const fn = watchTypes[ type(config.watch) ] || watchTypes.throws;
    const watch = fn(config.watch);

    return Object.assign(config, {
        watch
    });
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
    .then(normalizeWatch)
    .then((config) => {
        mockServer.server.emit('config', config);
        return Object.assign(config, {
            emit: (...args) => mockServer.server.emit(...args),
            on: (...args) => mockServer.server.on(...args)
        });
    })
    .then(prepMocks)
    .then(mockServer.init)
    .then((config) => {
        if (typeof config.port === 'number' && config.port >= 0) {
            return new Promise((resolve) => {
                mockServer.server.listen(config.port);
                mockServer.server.on('listening', () => {
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
