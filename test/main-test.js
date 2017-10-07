const test = require('tape');
const { exec } = require('child_process');
const http = require('http');

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

    suite.test('started on the port specified by config', (t) => {
        const expectedConfig = {
            port: 8080,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            logger: console,
            watch: true,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-2__',
            argv: false,
            settings: {
                port: 8080
            }
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.ok(true, '`loaded` event triggered');

                s.on('listening', (err) => {
                    t.ok(true, '`listening` event triggered');
                    const {
                        port
                    } = s.address();
                    t.equal(port, expectedConfig.port, `Listening on specified port`);
                
                    // shutdown and dereference the server
                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('emits an error if port unavailable', (t) => {
        // create an http server and have it listen on the port we are
        // going to configure satire to listen on.
        let blocking = http.createServer();
        blocking.listen(8081);
        const expectedConfig = {
            port: 8081,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            logger: console,
            watch: true,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-3__',
            argv: false,
            settings: {
                port: 8081
            }
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.ok(true, '`loaded` event triggered');

                s.on('error', (err) => {
                    t.ok(true, '`error` event triggered');

                    // shutdown and dereference the blocking server
                    blocking.close();
                    blocking = null;

                    // shutdown and dereference the server
                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('emits an error if mocks is invalid', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: 1234,
            logger: console,
            watch: true,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-3__',
            argv: false,
            settings: {
                mocks: 1234
            }
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('error', (err) => {
                t.ok(true, '`error` event triggered');

                // shutdown and dereference the server
                s.emit('shutdown');
                s = null;
                t.end();
            });
        });
    });

    suite.test('started on a random availble port if port is 0', (t) => {
        const expectedConfig = {
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
            name: '__satire-test-4__',
            argv: false,
            settings: {
                port: 0
            }
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.ok(true, '`loaded` event triggered');

                s.on('listening', (err) => {
                    t.ok(true, '`listening` event triggered');
                    const {
                        port
                    } = s.address();
                    t.ok((port !== expectedConfig.port && port > 0), `Listening on random port ${port}`);
                
                    // shutdown and dereference the server
                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });       
    });

    suite.test('not started if port is less than 0', (t) => {
        const expectedConfig = {
            port: null,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            logger: console,
            watch: true,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-5__',
            argv: false,
            settings: {
                port: null
            }
        });

        s.on('config', (cfg) => {
            t.ok(true, '`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.ok(true, '`loaded` event triggered');

                s.on('listening', (err) => {
                    t.fail(new Error(`${'`listening`'} event triggered when port is '${cfg.port}'`));
                });

                // timeout waiting for 'listening' is imperfect, but probably good enough
                setTimeout(() => {
                    // shutdown and dereference the server
                    s.emit('shutdown');
                    s = null;
                    t.end();
                }, 200);
            });
        });            
    });

    suite.end();
});

test('Testing CLI interface', (suite) => {
    suite.test('loads through satire cli', (t) => {
        const expectedStdout = 'Mock globs: ['+
            '\n  "/Users/amadsen/dev/node/satire/mocks/**/*",' +
            '\n  "/Users/amadsen/dev/node/satire/test/mocks/**/*"' +
          '\n]' +
          '\nListening on 50001';
        const cp = exec(
            `${process.argv[0]} ${require.resolve('../cli/satire.js')}`,
            {
                env: {
                    SATIRE_PORT: 50001
                }
            },
            (err, stdout, stderr) => {
                if (err && !err.killed) {
                    console.error(err);
                    t.fail(err, 'running in child process should not error');                    
                }
                t.equals(stderr, '', 'There should not be any output to stderr');
                t.equals(stdout, '', 'Should report listening...');

                t.end();
            }
        );

        setTimeout(() => {
            cp.kill();
        }, 250);
    });

    suite.test('index.js loads through satire cli when started directly', (t) => {
        const expectedStdout = 'Mock globs: ['+
            '\n  "/Users/amadsen/dev/node/satire/mocks/**/*",' +
            '\n  "/Users/amadsen/dev/node/satire/test/mocks/**/*"' +
          '\n]' +
          '\nListening on 50000';
        const cp = exec(
            `${process.argv[0]} ${require.resolve('../')}`,
            {
                env: {
                    SATIRE_PORT: 50000
                }
            },
            (err, stdout, stderr) => {
                if (err && !err.killed) {
                    console.error(err);
                    t.fail(err, 'running in child process should not error');                    
                }
                t.equals(stderr, '', 'There should not be any output to stderr');
                t.equals(stdout, '', 'Should report listening...');

                t.end();
            }
        );

        setTimeout(() => {
            cp.kill();
        }, 250);
    });

    suite.end();
});
