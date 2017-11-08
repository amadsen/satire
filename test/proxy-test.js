const test = require('tape-catch');
const request = require('request');

const chokidarWatcher = require('../lib/watchers/chokidar.js');

const satire = require('../');

/*
Test that 
- API calls to configured proxies are transformed and passed through
*/
test('Should support proxying of HTTP server', (suite) => {
    suite.test('should emit a config with proxyAPIs', (t) => {
        const port = 8090;
        const expectedProxyConfig = {
            port,
            mocks: [
                './mocks/**/*',
                './test/mocks/**/*'
            ],
            watch: chokidarWatcher,
            proxyAPIs: {
                '/proxy/': 'http://127.0.0.1:8090/',
                '/json-proxy/': 'http://127.0.0.1:8090/json/'
            },
            from: __dirname,
            _: { errors: [] }
        };

        let s = satire({
            name: '__satire-test-1__',
            argv: false,
            settings: {
                port,
                proxyAPIs: {
                    '/proxy/': 'http://127.0.0.1:8090/',
                    '/json-proxy/': 'http://127.0.0.1:8090/json/'
                }
            }
        });

        s.on('config', (cfg) => {
            t.pass('`config` event triggered');
            t.deepEqual(cfg, expectedProxyConfig, 'has expected proxy configuration');

            s.on('loaded', () => {
                t.pass('`loaded` event triggered');
            });

            s.on('listening', (err) => {
                t.error(err, 'listen() should not error');
                t.pass('`listening` event triggered');
                s.emit('string-test');
            });
        });

        s.on('string-test', () => {
            request(
                `http://127.0.0.1:${port}/proxy/string.txt`,
                (err, res, body) => {
                    t.error(err, 'should not return an error');
                    t.ok(res, 'should return a response object');
                    t.equals(res.statusCode, 200, 'should return a status code of 200');
                    t.equals(
                        res.headers['content-type'],
                        'text/plain',
                        'should return text/plain content-type'
                    );
                    t.equals(
                        body,
                        'This is a string',
                        'should return the expected proxied mock body'
                    );

                    // shutdown and dereference the server
                    s.emit('json-test');
                }
            );
        });

        s.on('json-test', () => {
            request(
                `http://127.0.0.1:${port}/json-proxy/test.json`,
                (err, res, body) => {
                    t.error(err, 'should not return an error');
                    t.ok(res, 'should return a response object');
                    t.equals(res.statusCode, 200, 'should return a status code of 200');
                    t.equals(
                        res.headers['content-type'],
                        'application/json',
                        'should return application/json content-type'
                    );
                    t.equals(
                        body,
                        JSON.stringify({
                            one: 1,
                            two: [0, 1],
                            three: {
                                a: "eh",
                                b: "bee",
                                c: "see"
                            }
                        }, null, 2),
                        'should return expected proxied mock body'
                    );

                    // shutdown and dereference the server
                    s.emit('end-test');
                }
            );
        });

        s.on('end-test', () => {
            // shutdown and dereference the server
            s.emit('shutdown');
            s = null;
            t.end();
        });
    });

    suite.end();
})