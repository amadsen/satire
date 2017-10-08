const test = require('tape');
const { spawn } = require('child_process');
const path = require('path');

const posixProjectPath = path.normalize(path.resolve(__dirname, '..'))
    .replace(/^[a-z]+?:/i, '')
    .split(path.sep)
    .join(path.posix.sep);

test('Testing command line interface', (suite) => {
    suite.test('loads through satire cli', (t) => {
        const expectedStdout = 'Mock globs: [' +
            '\n  "' + posixProjectPath + '/mocks/**/*",' +
            '\n  "' + posixProjectPath + '/test/mocks/**/*"' +
            '\n]' +
            '\nListening on 50001\n';
        let stdout = '';
        let timer = null;

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
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                // NOTE: using cp.kill() causes code coverage to be lost! 
                cp.send({ type: 'exit', exitCode: 0 });
            }, 100);
        });
          
        cp.stderr.on('data', (data) => {
            t.fail(new Error('There should not be any output to stderr'));
        });

        cp.on('close', (code, signal) => {
            t.equals(stdout, expectedStdout, 'Should report listening...');
            
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
        let timer = null;
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
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                // NOTE: using cp.kill() causes code coverage to be lost! 
                cp.send({ type: 'exit', exitCode: 0 });
            }, 100);
        });
          
        cp.stderr.on('data', (data) => {
            t.fail(new Error('There should not be any output to stderr'));
        });
          
        cp.on('close', (code, signal) => {
            t.equals(stdout, expectedStdout, 'Should report listening...');
            
            t.end();
        });
    });

    suite.end();
});
