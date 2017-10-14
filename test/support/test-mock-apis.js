const request = require('request');

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

    test('Should complete excercising test mock APIs', (t) => {
        t.end();
        done();
    });
}