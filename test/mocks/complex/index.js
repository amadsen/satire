module.exports = [{
    request: {
        method: /GET|POST/i,
        headers: [
            ({ accept }) => {
                console.log('1|Accept:', accept);
                return /json/.test(accept);
            },
            ({ authorization }) => {
                console.log('1|Authorization:', authorization);
                return /^Bearer\s/.test(authorization);
            },
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
            ({ accept }) => {
                console.log('2|Accept:', accept);
                return !/json/.test(accept)
            },
            ({ authorization }) => {
                console.log('2|Authorization:', authorization);
                return !/^Bearer\s/.test(authorization)
            },
        ]
    },
    response: {
        statusCode: 404,
        statusMessage: 'Not Found',
        body: 'Not Found'
    }
}];