#!/usr/bin/env node

const satire = require('../');
const server = satire({ argv: true })
    .on('listening', (err) => {
        const {
            port
        } = server.address();
        console.log(`Listening on ${port}`);
    })
    .on('request', (req, res) => {
        const start = process.hrtime();
        console.log(`Request for ${req.url}`);
        res
            .on('close', () => {
                const [sec, nano] = process.hrtime(start);
                console.warn(`WARN: Request for ${req.url} was closed after ${sec}s ${nano/1000000}ms`);
            })
            .on('finish', () => {
                const [sec, nano] = process.hrtime(start);
                console.log(`Completed request for ${req.url} in ${sec}s ${nano/1000000}ms`);
            });
    });
