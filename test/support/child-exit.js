process.on('message', (msg) => {
    if (msg && msg.type === 'exit') {
        process.exit(msg.exitCode || 0);        
    }
});
