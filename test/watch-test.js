const test = require('tape-catch');
const path = require('path');
const EventEmitter = require('events');

const chokidarWatcher = require('../lib/watchers/chokidar.js');

const satire = require('../');

const posixProjectPath = path.normalize(path.resolve(__dirname, '..'))
    .replace(/^[a-z]+?:/i, '')
    .split(path.sep)
    .join(path.posix.sep);

test('Should allow watch to be configured', (suite) => {
    suite.test('watch can be turned on - default', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-1__',
            argv: false,
            settings: {}
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch can be turned on - true', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-2__',
            argv: false,
            settings: {
                watch: true
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch can be turned off - false', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: false,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-3__',
            argv: false,
            settings: {
                watch: false
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch can be turned off - null', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: false,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-4__',
            argv: false,
            settings: {
                watch: null
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch can be turned off - undefined', (t) => {
        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: false,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-5__',
            argv: false,
            settings: {
                watch: undefined
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });
    
    suite.test('watch can be set to a function', (t) => {
        const mockWatcher = new EventEmitter();
        mockWatcher.close = () => {
            mockWatcher.emit('test-close');
        };

        const watchFn = (mockGlobs) => {
            setImmediate(() => {
                mockWatcher.emit('ready');
            });
            return mockWatcher;
        };

        const expectedConfig = {
            port: 0,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: watchFn,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-watch-test-6__',
            argv: false,
            settings: {
                watch: watchFn
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', () => {
                    t.pass('`listening` event triggered');

                    const testError = new Error(
                        'This is a test error.'
                    );

                    s.on('error', (err) => {
                        t.equals(err, testError, 'Test Error emitted as expected');

                        s.emit('shutdown');
                    });
                    mockWatcher.emit('error', testError);
                });
            });
        });

        mockWatcher.on('test-close', () => {
            t.pass('Shutdown calls watcher.close()');
            s = null;
            t.end();
        });
    });

    suite.test('watch can be set to a string', (t) => {
        const mockWatcher = require('./support/mock-watcher.js');

        const expectedGlobs = [
            `${posixProjectPath}/mocks/**/*`,
            `${posixProjectPath}/test/mocks/**/*`
        ];

        let s = satire({
            name: '__satire-watch-test-7__',
            argv: false,
            settings: {
                watch: './support/mock-watcher.js'
            }
        });

        s.on('error', (e) => {
            console.error(e);
            t.fail(e);
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            
            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', () => {
                    t.pass('`listening` event triggered');

                    t.deepEquals(
                        mockWatcher.args,
                        [expectedGlobs],
                        'configured arguments are passed to module'
                    );

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch can be set to an object', (t) => {
        const mockWatcher = require('./support/mock-watcher.js');

        const expectedGlobs = [
            `${posixProjectPath}/mocks/**/*`,
            `${posixProjectPath}/test/mocks/**/*`
        ];

        const args = ['arg1', 'arg2'];

        let s = satire({
            name: '__satire-watch-test-8__',
            argv: false,
            settings: {
                watch: {
                    module: './support/mock-watcher.js',
                    args: args
                }
            }
        });

        s.on('error', (e) => {
            t.fail(e);
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', () => {
                    t.pass('`listening` event triggered');

                    t.deepEquals(
                        mockWatcher.args,
                        [...args, expectedGlobs],
                        'configured arguments are passed to module'
                    );

                    s.emit('shutdown');
                    s = null;
                    t.end();
                });
            });
        });
    });

    suite.test('watch module not found', (t) => {
        const badModulePath = './support/bad-mock-watcher.js';
        const expectedErrorMsg = `Cannot find module '${badModulePath}'`;
        let s = satire({
            name: '__satire-watch-test-8__',
            argv: false,
            settings: {
                watch: {
                    module: badModulePath
                }
            }
        });

        s.on('error', (e) => {
            t.ok(e instanceof Error, 'An error was triggered');
            t.equals(
                e.message,
                expectedErrorMsg,
                'The error message indicates why the module was not loaded'
            );

            s.emit('shutdown');
            s = null;
            t.end();
        });
    });

    suite.test('unsupported watch triggers an error', (t) => {
        const badWatch = /^fee|fi|fo|fum/;
        const expectedErrorMsg = `Unsupported watch configuration: regexp ${badWatch}`;
        let s = satire({
            name: '__satire-watch-test-9__',
            argv: false,
            settings: {
                watch: badWatch
            }
        });

        s.on('error', (e) => {
            t.ok(e instanceof Error, 'An error was triggered');
            t.equals(
                e.message,
                expectedErrorMsg,
                'The error message contains the unsupported type and config'
            );

            s.emit('shutdown');
            s = null;
            t.end();
        });
    });

    suite.end();
});
