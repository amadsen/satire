const test = require('tape');

const satire = require('../');

const originalEnv = Object.assign(process.env);

const resetEnv = () => {
    Object.keys(process.env).forEach((k) => (delete process.env[k]));
    Object.keys(originalEnv).forEach((k) => (
        process.env[k] = originalEnv[k]
    ));
};

test('Should return an HTTP server', (suite) => {
    suite.test('that emits the running config', (t) => {
        const expectedDefaultConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            logger: console,
            watch: true,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-1__',
            argv: false,
            settings: {}
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedDefaultConfig, 'has expected default configuration');

            s.on('loaded', () => {
                t.ok(true, '`loaded` event triggered');

                // shutdown and dereference the server
                s.emit('shutdown');
                s = null;
                t.end();
            });
        });
    });

    // suite.test('started on the port specified by config', (t) => {
    
    // });

    // suite.test('started on a random availble port if port is 0', (t) => {
           
    // });

    // suite.test('not started if port is less than 0', (t) => {
                
    // });

    suite.end();
});
