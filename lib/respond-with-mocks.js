
const matchProps = require('./match-properties.js');
const responseFromObject = require('./response-from-object.js');

/*
 mock may be:
    - a function that takes url, request, and response as properties 
    of an option argument
    - an object with ONLY 'request' and 'response' keys
    - anything that can JSON.stringify()
    - an array or any of the above
*/

const fnHandler = (opts, { mock, path }) => (
    [].concat( typeof mock === 'function' ? mock(opts, path) : 'next' )
);

const objHandler = (opts, { mock, path }) => {
    if (
        mock &&
        mock.response &&
        ((l) => {
            return l === 1 || (mock.request && l === 2);
        })(Object.keys(mock).length) &&
        // try to match opts.request with mock.request
        // 'url', 'method', 'headers', 'trailers', 'httpVersion', ...
        matchProps(mock.request, opts.request, opts.url)
    ) {
        responseFromObject(mock.response, opts.response);
        return [];
    }

    return ['next'];
};

const jsonHandler = (opts, { mock }) => {
    let json;
    try {
        json = JSON.stringify(mock, null, 2);
    } catch (e) {
        return ['next'];
    }

    const res = opts.response;
    res.setHeader('Content-Type', 'application/json');
    res.end(json);

    return [];
};

const respondWithMocks = (opts) => {
    const arrayHandler = (opts, mocks) => {
        if (Array.isArray(mocks)) {
            // try all the handlers for each mock definition
            // in the mock array, stopping when the first one
            // does not return ['next', ...].
            return mocks.reduce((result, m) => {
                if (result && result[0] === 'next') {
                    return respondWithMocks({
                        url: opts.url,
                        request: opts.request,
                        response: opts.response,
                        mocks: m
                    });
                }
                return result;
            }, ['next'])
        }

        return ['next'];
    };

    const handlers = [
        arrayHandler,
        fnHandler,
        objHandler,
        jsonHandler
    ];

    const {
        url,
        request,
        response,
        mocks
    } = opts;          

    return handlers.reduce((result, fn) => {
        if (result && result[0] === 'next') {
            return fn(
                {
                    url,
                    request,
                    response
                },
                mocks
            );
        }
        return result;
    }, ['next']);
};

module.exports = respondWithMocks;
