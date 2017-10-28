const sane = require('sane');
const path = require('path');
const { EventEmitter } = require('events');
const { fork } = require('child_process');

if (process.mainModule !== module) {
    
    // export a function that passes watcher args to a forked
    // process and forwards events back.
    module.exports = (...args) => {
        // prepare a child process to actually run the watcher.
        const cp = fork(__filename);

        const exportedWatcher = new EventEmitter();
        cp.send({ type: 'watcher-args', eventData: args });

        // handle messages from the child
        const childMsgHandlers = {
            noop: () => {},
            'watcher-ready': (...eventData) => exportedWatcher.emit('ready', ...eventData),
            'watcher-error': (...eventData) => exportedWatcher.emit('error', ...eventData),
            'watcher-add': (...eventData) => {
                exportedWatcher.emit('add', ...eventData);
                exportedWatcher.emit('all', 'add', ...eventData);
            },
            'watcher-change': (...eventData) => {
                exportedWatcher.emit('change', ...eventData);
                exportedWatcher.emit('all', 'change', ...eventData);
            },
            'watcher-delete': (...eventData) => {
                exportedWatcher.emit('delete', ...eventData);
                exportedWatcher.emit('all', 'delete', ...eventData);
            }
        };

        cp.on('message', ({ type, eventData }) => (
            (childMsgHandlers[type] || childMsgHandlers.noop)(...[].concat(eventData))
        ));
        
        exportedWatcher.close = () => {
            cp.send({ type: 'watcher-close' });
        }

        return exportedWatcher;
    }
}

if (process.mainModule === module) {
    function sharedFsRoot(mockGlobs) {
        const fsRoot = path.parse(process.cwd()).root;
        const globs = [].concat(mockGlobs);
        const rootParts = globs
            .reduce((shared, aGlob) => {
                const parts = aGlob.split(path.posix.sep);
                if (shared) {
                    let done = false;
                    return shared.reduce((same, segment, i) => {
                        if (!done && segment === parts[i]) {
                            same.push(segment);
                        } else {
                            done = true;
                        }
                        return same;
                    }, []);
                }
                return parts;
            }, null);

        const root = path.normalize(path.join(fsRoot, ...(rootParts || null)));
        return {
            root,
            globs: globs.map((g) => path.relative(root, g))
        };
    }

    function send(type, ...args) {
        process.send({ type, eventData: args });
    }

    function handleFsEvent(type, filepath, root, stat) {
        send(
            type,
            path.join(root, filepath),
            stat
        );
    }

    let watcher;
    function watch(mockGlobs) {
        const {
            root,
            globs
        } = sharedFsRoot(mockGlobs);

        watcher = sane(root, {
            glob: globs
        });
        watcher.on('error', send.bind(null, 'watcher-error'));
        watcher.on('add', handleFsEvent.bind(null, 'watcher-add'));
        watcher.on('change', handleFsEvent.bind(null, 'watcher-change'));
        watcher.on('delete', handleFsEvent.bind(null, 'watcher-delete'));
        watcher.on('ready', send.bind(null, 'watcher-ready'));
    }

    // handle messages from the parent
    const parentMsgHandlers = {
        'watcher-close': () => {
            if (watcher) {
                watcher.close();
            }
            process.exit();
        },
        'watcher-args': watch,
        noop: () => {}
    }

    process.on('message', ({ type, eventData }) => (
        (parentMsgHandlers[type] || parentMsgHandlers.noop)(...[].concat(eventData))
    ));
}
