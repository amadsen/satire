const responseFromObject = (mockResponse, response) => {
    // statusCode
    if (mockResponse.statusCode) {
        response.statusCode = mockResponse.statusCode
    }
    // statusMessage
    if (mockResponse.statusMessage) {
        response.statusMessage = mockResponse.statusMessage
    }
    // headers
    if (mockResponse.headers) {
        Object.keys(mockResponse.headers).map((name) => (
            [name, mockResponse.headers[name]]
        )).forEach(([name, value]) => response.setHeader(name, value));
    }
    // trailers
    if (mockResponse.trailers) {
        // get all trailer keys and set the trailer header
        response.setHeader('Trailer', Object.keys(mockResponse.trailers).join(', '));
    }
    // body
    // TODO: consider automatically setting the Content-type header if it isn't
    // already set 
    // if (mockResponse.body && typeof mockResponse.body.pipe === 'function') {
    //     mockResponse.body.pipe(response);
    // } else {
        
    // }
    response.write(
        ((b) => {
            if (
                typeof b === 'string' || 
                b instanceof Buffer 
            ) {
                return b;
            }

            return JSON.stringify(b, null, 2);
        })(mockResponse.body)
    );
    // trailers - again
    if (mockResponse.trailers) {
        // add the actual trailers
        response.addTrailers(mockResponse.trailers);
    }
    response.end();
};

module.exports = responseFromObject;
