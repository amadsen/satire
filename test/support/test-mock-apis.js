const request = require('request');
const fs = require('fs');
const path = require('path');

const greenDotPng = fs.readFileSync(
    path.join(__dirname, '..', 'mocks', 'green-dot.png'),
    { encoding: 'utf8' }
);
const greenDotSvg = fs.readFileSync(
    path.join(__dirname, '..', 'mocks', 'green-dot.svg'),
    { encoding: 'utf8' }
);

// TODO: make http requests for each of the mock files

module.exports = (test, { port, mockGlobs }, done) => {
    test('When no mock is found', (t) => {
        request(`http://127.0.0.1:${port}/does/not/exist/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 404, 'should return a status code of 404');

            t.end();
        });
    });

    test('When connection is closed', (t) => {
        request({
            url: `http://127.0.0.1:${port}/slow-echo/`,
            timeout: 20
        }, (err, res, body) => {
            t.ok(err && /TIMEDOUT/.test(err.code), 'should return an error');
            t.notOk(!!res, 'should not return a response object');

            t.end();
        });
    });

    test('When request is for a module', (t) => {
        request(`http://127.0.0.1:${port}/a-module`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a module (trailing slash)', (t) => {
        request(`http://127.0.0.1:${port}/a-module/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a module (index.js)', (t) => {
        request(`http://127.0.0.1:${port}/a-module/index.js`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for an invalid module', (t) => {
        request(`http://127.0.0.1:${port}/circular/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 404, 'should return a status code of 404');
            t.equals(body, 'Not Found', 'should return expected body');
            t.pass('should ignore invalid module');

            t.end();
        });
    });

    test('When request is for a file under a non-function module (matching json)', (t) => {
        request(`http://127.0.0.1:${port}/a-module/with-json-dir/test-req-res.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'You got it!', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a file under a non-function module (plain json)', (t) => {
        request(`http://127.0.0.1:${port}/a-module/with-json-dir/test.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
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
                'should return expected body'
            );

            t.end();
        });
    });

    test('When request is for a module that is a function', (t) => {
        request(`http://127.0.0.1:${port}/a-fn-module/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a function module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a path under a module that is a function', (t) => {
        request(`http://127.0.0.1:${port}/a-fn-module/with-json-dir/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a function module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a file under a module that is a function (matching json)', (t) => {
        request(`http://127.0.0.1:${port}/a-fn-module/with-json-dir/test-req-res.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a function module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a file under a module that is a function (plain json)', (t) => {
        request(`http://127.0.0.1:${port}/a-fn-module/with-json-dir/test.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'a function module', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a json file (matching json)', (t) => {
        request(`http://127.0.0.1:${port}/json/test-req-res.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(body, 'You got it!', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a json file (plain json)', (t) => {
        request(`http://127.0.0.1:${port}/json/test.json`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
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
                'should return expected body'
            );

            t.end();
        });
    });

    test('When request is for a text file', (t) => {
        request(`http://127.0.0.1:${port}/string.txt`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(
                res.headers['content-type'],
                'text/plain',
                'should return text/plain content-type'
            );
            t.equals(body, 'This is a string', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a png file', (t) => {
        request(`http://127.0.0.1:${port}/green-dot.png`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(
                res.headers['content-type'],
                'image/png',
                'should return png content-type'
            );
            t.equals(body, greenDotPng, 'should return expected body');

            t.end();
        });
    });

    test('When request is for an svg file', (t) => {
        request(`http://127.0.0.1:${port}/green-dot.svg`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(
                res.headers['content-type'],
                'image/svg+xml',
                'should return svg content-type'
            );
            t.equals(body, greenDotSvg, 'should return expected body');

            t.end();
        });
    });

    test('When request is for a mock with complex matching conditions (404)', (t) => {
        request(`http://127.0.0.1:${port}/complex/`, (err, res, body) => {
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 404, 'should return a status code of 404');
            t.equals(body, 'Not Found', 'should return expected body');

            t.end();
        });
    });

    test('When request is for a mock with complex matching conditions (200)', (t) => {
        request({
             url: `http://127.0.0.1:${port}/complex/`,
             headers: {
                 Accept: 'application/json',
                 Authorization: 'Bearer mockbearertoken'
             }
            },
            (err, res, body) => {
                t.error(err, 'should not return an error');
                t.ok(res, 'should return a response object');
                t.equals(res.statusCode, 200, 'should return a status code of 200');
                t.equals(
                    res.headers['content-type'],
                    'application/json',
                    'should return application/json content-type'
                );
                t.deepEquals(
                    JSON.parse(body),
                    {
                        imaginary: true,
                        value: 2
                    },
                    'should return expected body'
                );

                t.end();
            }
        );
    });

    test('When request is for a mock with timeToRespond set', (t) => {
        const start = Date.now();
        request(`http://127.0.0.1:${port}/timeout/`, (err, res, body) => {
            const duration = Date.now() - start;
            t.error(err, 'should not return an error');
            t.ok(res, 'should return a response object');
            t.equals(res.statusCode, 200, 'should return a status code of 200');
            t.equals(
                res.headers['content-type'],
                'application/json',
                'should return application/json content-type'
            );
            t.deepEquals(
                JSON.parse(body),
                {
                    tortise: 1,
                    hare: 0
                },
                'should return expected body'
            );
            t.ok(/[34]\d\d/.test(`${duration}`), 'should take about 300ms')

            t.end();
        });
    });

    test('Should complete excercising test mock APIs', (t) => {
        t.end();
        done();
    });
}