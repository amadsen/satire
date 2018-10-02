const test = require('tape-catch');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const request = require('request');
const testMockApis = require('./support/test-mock-apis.js');

const posixProjectPath = path.normalize(path.resolve(__dirname, '..'))
    .replace(/^[a-z]+?:/i, '')
    .split(path.sep)
    .join(path.posix.sep);

    test('Testing command line interface', (suite) => {
        suite.test('loads through satire cli', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/test/support/test-pkg-cfg/custom-mocks/**/*"' +
            '\n]' +
            '\nListening on 50001\n';
        let stdout = '';
        let listening = false;

        const cp = spawn(
            `${process.argv[0]}`,
            [
                '-r',
                `${require.resolve('./support/child-exit.js')}`,
                `${require.resolve('../cli/satire.js')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50001
                },
                cwd: `${path.join(__dirname, './support/test-pkg-cfg/')}`,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
            if (!listening && /Listening\son\s\d+/.test(stdout)) {
                listening = true
                cp.emit('listening');
            }
        });

        cp.on('listening', () => {
            t.pass('Should report listening...');
            // NOTE: using cp.kill() causes code coverage to be lost!
            cp.send({ type: 'exit', exitCode: 0 });
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout.slice(0, expectedStdout.length),
                expectedStdout,
                'Should report mock paths and port on stdout'
            );

            t.end();
        });
    });

    suite.test('loads through satire cli', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/mocks/**/*",' +
            '\n  "' + posixProjectPath + '/test/mocks/**/*"' +
            '\n]' +
            '\nListening on 50001\n';
        let stdout = '';
        let stderr = '';
        let listening = false;

        const cp = spawn(
            `${process.argv[0]}`,
            [
                '-r',
                `${require.resolve('./support/child-exit.js')}`,
                `${require.resolve('../cli/satire.js')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50001
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
            if (!listening && /Listening\son\s\d+/.test(stdout)) {
                listening = true
                cp.emit('listening');
            }
        });
          
        cp.stderr.on('data', (data) => {
            stderr += `${data}`;
        });

        cp.on('listening', () => {
            t.pass('Should report listening...');
            testMockApis(t.test, {
                port: 50001,
                mockGlobs: [
                    posixProjectPath + '/mocks/**/*',
                    posixProjectPath + '/test/mocks/**/*'
                ]
            }, () => {
                // NOTE: using cp.kill() causes code coverage to be lost! 
                cp.send({ type: 'exit', exitCode: 0 });                
            });
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout.slice(0, expectedStdout.length),
                expectedStdout,
                'Should report mock paths and port on stdout'
            );
 
            const lines = stdout.slice(expectedStdout.length).split('\n');
            const errLines = stderr.split('\n');
            t.ok(
                /GET \/does\/not\/exist\/ [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/.test(
                    lines[0]
                ),
                'Should log requests to stdout with uuid'
            );
            t.ok(
                /GET \/does\/not\/exist\/ in \ds \d+\.\d+ms/.test(lines[1]),
                'Should log request elapsed time to stdout'
            );
            t.ok(
                /WARN: GET \/slow-echo\/ was closed after \ds \d+\.\d+ms/.test(errLines[0]),
                'Should log a warning when request  is closed with elapsed time to stderr'
            );
           
            t.end();
        });
    });

    suite.test('Logs error and quits when port not available', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/mocks/**/*",' +
            '\n  "' + posixProjectPath + '/test/mocks/**/*"' +
            '\n]' +
            '\n';
        let stdout = '';
        let stderr = '';

        let blockingHttp = http.createServer();
        blockingHttp.listen(50002)
        const cp = spawn(
            `${process.argv[0]}`,
            [
                `${require.resolve('../cli/satire.js')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50002
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
        });
          
        cp.stderr.on('data', (data) => {
            stderr += `${data}`;
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout.slice(0, expectedStdout.length),
                expectedStdout,
                'Should report mock paths on stdout'
            );
 
            t.ok(/ERROR:.*EADDRINUSE/.test(stderr), 'should report address in use to stderr');
           
            blockingHttp.close();
            blockingHttp = null;
            t.end();
        });
    });

    suite.test('Logs error and quits when invalid mocks provided', (t) => {
        const expectedStdout = '';
        let stdout = '';
        let stderr = '';

        const cp = spawn(
            `${process.argv[0]}`,
            [
                `${require.resolve('../cli/satire.js')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50003,
                    SATIRE_MOCKS: ''
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
        });
          
        cp.stderr.on('data', (data) => {
            stderr += `${data}`;
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout,
                expectedStdout,
                'Should not report anything on stdout'
            );

            t.equals(
                stderr.split('\n').filter((line) => !!line)[0],
                'ERROR: Error: Invalid mocks configuration: \'\'',
                'should report invalid mocks to stderr'
            );

            t.end();
        });
    });

    suite.test('Logs error and exits on unhandled exception', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/mocks/**/*",' +
            '\n  "' + posixProjectPath + '/test/mocks/**/*"' +
            '\n]' +
            '\nListening on 50004\n';
        let stdout = '';
        let stderr = '';
        let listening = false;

        const cp = spawn(
            `${process.argv[0]}`,
            [
                `${require.resolve('../cli/satire.js')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50004
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
            if (!listening && /Listening\son\s\d+/.test(stdout)) {
                listening = true
                cp.emit('listening');
            }
        });
          
        cp.stderr.on('data', (data) => {
            stderr += `${data}`;
        });

        cp.on('listening', () => {
            t.pass('Should report listening...');
            request('http://127.0.0.1:50004/throws/', (err, res, body) => {
                t.ok(err && err.code === 'ECONNRESET', 'should return a ECONNRESET error');
            });
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout.slice(0, expectedStdout.length),
                expectedStdout,
                'Should report mock paths and port on stdout'
            );

            const lines = stdout.slice(expectedStdout.length).split('\n');
            t.ok(
                /GET \/throws\/ [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/.test(
                    lines[0]
                ),
                'Should log requests to stdout with uuid before mock crashes server'
            );

            t.equals(
                stderr.split('\n').filter((line) => !!line)[0],
                'Error: Deliberate unhandled exception for testing',
                'should report cause of server crash to stderr'
            );

            t.end();
        });
    });

    suite.test('index.js loads through satire cli when started directly', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/mocks/**/*",' +
            '\n  "' + posixProjectPath + '/test/mocks/**/*"' +
            '\n]' +
            '\nListening on 50000\n';
        let stdout = '';
        let stderr = '';
        let listening = false;

        const cp = spawn(
            `${process.argv[0]}`,
            [
                '-r',
                `${require.resolve('./support/child-exit.js')}`,
                `${require.resolve('../')}`
            ],
            {
                env: {
                    SATIRE_PORT: 50000
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            }
        );

        cp.stdout.on('data', (data) => {
            stdout += `${data}`;
            if (!listening && /Listening\son\s\d+/.test(stdout)) {
                listening = true
                cp.emit('listening');
            }
        });
          
        cp.stderr.on('data', (data) => {
            stderr += `${data}`;
        });
        
        cp.on('listening', () => {
            t.pass('Should report listening...');
            testMockApis(t.test, {
                port: 50000,
                mockGlobs: [
                    posixProjectPath + '/mocks/**/*',
                    posixProjectPath + '/test/mocks/**/*'
                ]
            }, () => {
                // NOTE: using cp.kill() causes code coverage to be lost! 
                cp.send({ type: 'exit', exitCode: 0 });                
            });
        });

        cp.on('close', (code, signal) => {
            t.equals(
                stdout.slice(0, expectedStdout.length),
                expectedStdout,
                'Should report mock paths and port on stdout'
            );

            const lines = stdout.slice(expectedStdout.length).split('\n');
            const errLines = stderr.split('\n');
            t.ok(
                /GET \/does\/not\/exist\/ [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/.test(
                    lines[0]
                ),
                'Should log requests to stdout with uuid'
            );
            t.ok(
                /GET \/does\/not\/exist\/ in \ds \d+\.\d+ms/.test(lines[1]),
                'Should log request elapsed time to stdout'
            );
            t.ok(
                /WARN: GET \/slow-echo\/ was closed after \ds \d+\.\d+ms/.test(errLines[0]),
                'Should log a warning when request  is closed with elapsed time to stderr'
            );
            
            t.end();
        });
    });

    suite.end();
});
