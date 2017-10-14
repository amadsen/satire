
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

const fnHandler = (opts, { mock, location }) => (
    [].concat( typeof mock !== 'function' ? 'next' : mock(
        Object.assign(opts, { location })
    ))
);

const objHandler = (opts, { mock, location }) => {
    if (
        mock &&
        mock.response &&
        // only return object mocks for exact location matches
        req.url === location
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

const jsonHandler = ({ request: req, response: res }, { mock, location }) => {
    // only return json mocks for exact location matches
    if (!mock || req.url !== location) {
        return ['next'];
    }

    let json;
    try {
        json = JSON.stringify(mock, null, 2);
    } catch (e) {
        return ['next'];
    }

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
            }, ['next']);
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
