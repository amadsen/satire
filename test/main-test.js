const test = require('tape-catch');
const http = require('http');
const fs = require('fs');
const path = require('path');
const request = require('request');
const testMockApis = require('./support/test-mock-apis.js');

const chokidarWatcher = require('../lib/watchers/chokidar.js');

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
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-1__',
            argv: false,
            settings: {}
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedDefaultConfig, 'has expected default configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                // shutdown and dereference the server
                s.emit('shutdown');
                s = null;
                t.end();
            });
        });
    });

    /*
    Add test for directly configured mocks
    */
    suite.test('that supports directly configured mocks', (t) => {
        const expectedDirectConfig = {
            port: 0,
            mocks: [
                { path: '/direct/', mock: 'This is a direct mock' }
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-2__',
            argv: false,
            settings: {
                mocks: [
                    { path: '/direct/', mock: 'This is a direct mock' }
                ]
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedDirectConfig, 'has expected direct mock configuration');
        });

        s.on('listening', (err) => {
            t.pass('`listening` event triggered');
            const {
                port
            } = s.address();

            request(
                `http://127.0.0.1:${port}/direct/`,
                (err, res, body) => {
                    t.error(err, 'should not return an error');
                    t.ok(res, 'should return a response object');
                    t.equals(res.statusCode, 200, 'should return a status code of 200');
                    t.equals(
                        body,
                        '"This is a direct mock"',
                        'should return configured direct mock'
                    );

                    // shutdown and dereference the server
                    s.emit('shutdown');
                    s = null;
                    t.end();
                }
            );
        });
    });

    suite.test('started on the port specified by config', (t) => {
        const expectedConfig = {
            port: 8080,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-3__',
            argv: false,
            settings: {
                port: 8080
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');
                    const {
                        port
                    } = s.address();
                    t.equal(port, expectedConfig.port, `Listening on specified port`);
                
                    testMockApis(t.test, {
                         port,
                         mockGlobs: cfg.mocks
                    }, () => {
                        // shutdown and dereference the server
                        s.emit('shutdown');
                        s = null;
                        t.end();
                    });
                });
            });
        });
    });

    suite.test('should fire events for changes to mock files', (t) => {
        const expectedConfig = {
            port: 8080,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        const expectedNotWatchedPath = path.join(__dirname, '..', 'should-not-be-watched.json');

        let s = satire({
            name: '__satire-test-4__',
            argv: false,
            settings: {
                port: 8080
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');
                    const {
                        port
                    } = s.address();
                    t.equal(port, expectedConfig.port, `Listening on specified port`);

                    fs.writeFileSync(
                        expectedNotWatchedPath,
                        JSON.stringify({
                            bad: 'Do not touch!'
                        })
                    );

                    request(
                        `http://127.0.0.1:${port}/post-file/`,
                        {
                            method: 'POST',
                            json: true,
                            body: {
                                name: 'posted-file.json',
                                contents: {
                                    one: 'fish',
                                    two: 'fish',
                                    red: 'fish',
                                    blue: 'fish'
                                }
                            }
                        },
                        (err, res, body) => {
                            t.error(err, 'should not return an error');
                            t.ok(res, 'should return a response object');
                            t.equals(res.statusCode, 204, 'should return a status code of 204');
                        }
                    );
                });

                s.once('mock-updated', (aFilePath) => {
                    const expectedPath = path.normalize(
                        path.join(__dirname, 'mocks', 'post-file', 'posted-file.json')
                    );

                    t.pass('should emit "mock-updated" event');
                    t.equals(
                        aFilePath,
                        expectedPath,
                        'should emit `mock-updated` event for changes to mocks on file system'
                    );

                    s.once('mock-updated', (deletedFilePath) => {
                        t.equals(
                            deletedFilePath,
                            expectedPath,
                            'should emit "mock-updated" event for deletes'
                        );
                        // shutdown and dereference the server
                        s.emit('shutdown');
                        s = null;
                        t.end();
                    });
                    fs.unlinkSync(expectedNotWatchedPath);
                    fs.unlinkSync(expectedPath);
                });
            });
        });
    });

    suite.test('should support multiple mock globs', (t) => {
        const expectedConfig = {
            port: 8080,
            mocks: [
                './test/more-mocks/(a-fn-module|a-module)(|/*|/**/*)',
                './test/mocks/(post-file|json)(|/*|/**/*)'
            ],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        const expectedNotWatchedPath = path.join(__dirname, '..', 'should-not-be-watched-2.json');

        let s = satire({
            name: '__satire-test-5__',
            argv: false,
            settings: {
                port: 8080,
                mocks: [
                    './test/more-mocks/(a-fn-module|a-module)(|/*|/**/*)',
                    './test/mocks/(post-file|json)(|/*|/**/*)'
                ]
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');
                    const {
                        port
                    } = s.address();
                    t.equal(port, expectedConfig.port, `Listening on specified port`);

                    fs.writeFileSync(
                        expectedNotWatchedPath,
                        JSON.stringify({
                            bad: 'Do not touch!'
                        })
                    );

                    request(
                        `http://127.0.0.1:${port}/post-file/`,
                        {
                            method: 'POST',
                            json: true,
                            body: {
                                name: 'posted-file-2.json',
                                contents: {
                                    one: 'fish',
                                    two: 'fish',
                                    red: 'fish',
                                    blue: 'fish'
                                }
                            }
                        },
                        (err, res, body) => {
                            t.error(err, 'should not return an error');
                            t.ok(res, 'should return a response object');
                            t.equals(res.statusCode, 204, 'should return a status code of 204');
                        }
                    );
                });

                s.once('mock-updated', (aFilePath) => {
                    const expectedPath = path.normalize(
                        path.join(__dirname, 'mocks', 'post-file', 'posted-file-2.json')
                    );

                    t.pass('should emit "mock-updated" event');
                    t.equals(
                        aFilePath,
                        expectedPath,
                        'should emit `mock-updated` event for changes to mocks on file system'
                    );

                    s.once('mock-updated', (deletedFilePath) => {
                        t.equals(
                            deletedFilePath,
                            expectedPath,
                            'should emit "mock-updated" event for deletes'
                        );
                        // shutdown and dereference the server
                        s.emit('shutdown');
                        s = null;
                        t.end();
                    });
                    fs.unlinkSync(expectedNotWatchedPath);
                    fs.unlinkSync(expectedPath);
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
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-6__',
            argv: false,
            settings: {
                port: 8081
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('error', (err) => {
                    t.pass('`error` event triggered');

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
            mocks: [1234],
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-7__',
            argv: false,
            settings: {
                mocks: 1234
            }
        });

        s.on('error', (err) => {
            t.pass('`error` event triggered');

            // shutdown and dereference the server
            s.emit('shutdown');
            s = null;
            t.end();
        });
    });

    suite.test('started on a random availble port if port is 0', (t) => {
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
            name: '__satire-test-8__',
            argv: false,
            settings: {
                port: 0
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

                s.on('listening', (err) => {
                    t.pass('`listening` event triggered');
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
            watch: chokidarWatcher,
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-9__',
            argv: false,
            settings: {
                port: null
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedConfig, 'has expected configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');

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

    suite.test('watch can be turned off', (t) => {
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
            name: '__satire-test-10__',
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
                    const {
                        port
                    } = s.address();

                    testMockApis(t.test, {
                         port,
                         mockGlobs: cfg.mocks
                    }, () => {
                        // shutdown and dereference the server
                        s.emit('shutdown');
                        s = null;
                        t.end();
                    });
                });
            });
        });
    });

    suite.end();
});
