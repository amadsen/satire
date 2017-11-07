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
const trike = require('trike');

const defaultSettings = {
    port: 0,
    mocks: [
        './mocks/**/*',
        './test/mocks/**/*'
    ],
    watch: true
};

function normalizeMocks(config) {
    const mocks = [].concat(
        (typeof config.mocks === 'string' ?
            trike(JSON.parse, config.mocks)[1] : null
        ) || config.mocks
    ).filter((mock) => {
        if (!(mock && (typeof mock === 'string' || (mock.path && mock.mock)))) {
            throw new Error(`Invalid mocks configuration: '${config.mocks}'`);
        }
        return true;
    });

    return Object.assign(config, {
        mocks
    });
}

const watchTypes = {
    // explicitly treat null and undefined as false
    null: () => false,
    undefined: () => false,
    // config.watch may be a function
    function: ({ watch }) => watch,
    object: ({ watch, from }) => {
        // or an object with module and args
        const [err, watcher] = mayRequire({
            /*
            Require in the context of the file that called
            satire UNLESS it is the satire CLI.
            */
            from: from || process.cwd() 
        })(watch.module);

        if (err) {
            // may-require let us specifify a "from" directory
            throw err;
        }

        return watcher.bind(null, ...(watch.args || []));
    },
    string: ({ watch, from }) => watchTypes.object({
        watch: {
            module: watch
        },
        from
    }),
    boolean: ({ watch }) => {
        // or true, indicating the default watchers
        if (watch === true) {
            return require('./lib/watchers/chokidar.js');
        }
        // false means no watchers
        return false;
    },
    error: ({ watch, type }) => {
        throw new Error(`Unsupported watch configuration: ${type} ${watch}`);
    }
};

function normalizeWatch(config, from) {
    const t = type(config.watch);
    const fn = watchTypes[t] || watchTypes.error;
    const watch = fn({
        watch: config.watch,
        type: t,
        from
    });

    return Object.assign(config, {
        watch
    });
}

function satire({ argv, settings, name }) {
    const from = callingFile({
        dir: true,
        ignore: [require.resolve('./cli/satire.js')]
    });

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
    .then((config) => normalizeWatch(config, from))
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
