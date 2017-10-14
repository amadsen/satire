#!/usr/bin/env node
const errorHandler = (err) => {
    console.error(err);
    process.exit(1);
}
process.on('unhandledRejection', errorHandler);
process.on('uncaughtException', errorHandler);

const satire = require('../');
const server = satire({ argv: true })
    .on('mock-globs', (globs) => console.log(`Mock globs: ${JSON.stringify(globs, null, 2)}`) )
    .on('listening', (err) => {
        const {
            port
        } = server.address();
        console.log(`Listening on ${port}`);
    })
    .on('mock-start', ({ correlationId: cid, req, res }) => {
        const start = process.hrtime();
        console.log(`${req.method} ${req.url} ${cid}`);
        res
            .on('mock-end', ({ correlationId: cid, type, req, res }) => {
                const [sec, nano] = process.hrtime(start);
                const duration = `${sec}s ${nano/1000000}ms`;
                if (type !== 'finish') {
                    console.warn(`WARN: ${req.method} ${req.url} was closed after ${duration}`);
                } else {
                    console.log(`${req.method} ${req.url} in ${duration}`);
                }
            });
    })
    .on('error', (err) => {
        console.error('\n\nERROR:', err);
        process.exit(1);
    });
