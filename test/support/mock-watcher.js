const EventEmitter = require('events');

// a single shared mock watcher so we can compare to it
const mockWatcher = new EventEmitter();
mockWatcher.close = () => {
    mockWatcher.emit('test-close');
};

const mockWatcherFn = (...args) => {
    setImmediate(() => {
        mockWatcher.emit('ready');
    });
    mockWatcherFn.args = args;
  
    return mockWatcher;
  };

module.exports = mockWatcherFn;
