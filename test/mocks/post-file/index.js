const fs = require('fs');
const path = require('path');

module.exports = ({ request: req, response: res }) => {
    let chunks = [];
    let error;
    const handleError = (err, statusCode, statusMessage) => {
        res.statusCode = statusCode || err.statusCode || 500;
        res.statusMessage = statusMessage || err.statusMessage || 'Server Error';
        res.send(res.statusMessage);
        console.error(err);
        res.end();
        error = err;
    }
    req.on('error', (err) => {
        handleError(err, 400, 'Error recieving request body');
    });
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        if (error) {
            return;
        }
        const body = chunks.reduce((str, c) => `${str}${c}`, '');
        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch(e) {
            return handleError(e, 400, 'Unable to parse request body');
        }

        const nameToWrite = path.normalize(
            path.join(__dirname, parsed.name.replace(/[^-_a-z0-9\.]/ig,'-'))
        );

        if (path.relative(__dirname, nameToWrite)[0] === '.') {
            return handleError(e, 400, 'Invalid file name specified');
        }

        fs.writeFile(
            nameToWrite,
            JSON.stringify(parsed.contents),
            (err) => {
                if (err) {
                    return handleError(err, 500, 'Unable to save file');
                }
                res.statusCode = 204;
                res.end();
            }
        );
    });
};
