module.exports = [{
    request: {
        method: /GET|POST/i,
        headers: [
            ({ accept }) => /json/.test(accept),
            ({ authorization }) => /^Bearer\s/.test(authorization),
        ]
    },
    response: {
        headers: {
            "Content-Type": "application/json"
        },
        statusCode: 200,
        body: {
            imaginary: true,
            value: 2
        }
    }
}, {
    request: {
        method: /GET|POST/i,
        headers: [
            ({ accept }) => !/json/.test(accept),
            ({ authorization }) => !/^Bearer\s/.test(authorization),
        ]
    },
    response: {
        statusCode: 404,
        statusMessage: 'Not Found',
        body: 'Not Found'
    }
}];