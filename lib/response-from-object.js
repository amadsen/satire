const responseFromObject = (mockResponse, response) => {
    const timeToRespond = mockResponse.timeToRespond > 0 ? 
        mockResponse.timeToRespond : 0;

    setTimeout(() => {
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
        /*
        TODO: add trailer support back if it seems useful
        */
        // // trailers
        // if (mockResponse.trailers) {
        //     // get all trailer keys and set the trailer header
        //     response.setHeader('Trailer', Object.keys(mockResponse.trailers).join(', '));
        // }
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
        /*
        TODO: add trailer support back if it seems useful
        */
        // // trailers - again
        // if (mockResponse.trailers) {
        //     // add the actual trailers
        //     response.addTrailers(mockResponse.trailers);
        // }
        response.end();
    }, timeToRespond);
};

module.exports = responseFromObject;
