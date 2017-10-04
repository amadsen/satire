# Satire

Intelligent mocking (of http endpoints) with a purpose.

## Install

Satire is intended to be installed as a development dependency.

~~~bash
npm install --save-dev satire
~~~

Installing Satire as a dependency allows using the javascript API or the `satire` CLI - if `./node_modules/.bin` is in your `PATH`. It also ensures that your project uses the version of `satire` it is intended to.

However, the `satire` CLI can also be installed globally.

~~~bash
npm install -g satire
~~~

## Features

+ emits events when requests are received and responses are sent
+ file-based responses (particularly for GET requests)
+ other HTTP methods supported through modules
+ auto-reload when mock files change
+ optional proxy to actual APIs
