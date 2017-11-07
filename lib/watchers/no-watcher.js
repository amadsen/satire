const path = require('path');
const { EventEmitter } = require('events');
const manyglob = require('../utils/many-glob.js');

const find = manyglob();

module.exports = (mockGlobs) => {
  const exportedWatcher = new EventEmitter();

  const emit = (type, filepath) => {
    exportedWatcher.emit(type, filepath);
    exportedWatcher.emit('all', type, filepath);
  };

  find(mockGlobs)
  .then((paths) => paths.map((mockPath) => emit('add', mockPath)))
  .then(
    () => exportedWatcher.emit('ready'),
    (err) => exportedWatcher.emit('error', err)
  );

  // NOTE: nothing to close() because we are not really watching
  exportedWatcher.close = function noop() {};
  
  return exportedWatcher;
};
