# Satire

Intelligent mocking (of http endpoints) with a purpose.

## Quick Start

1. Install as a devDependency: `npm install --save-dev satire`
2. Add an npm script: `..."scripts": { ..."mocks": "satire" }`
3. Put `.json` files in a `mocks/` subdirectory of your project. The relative filesystem path (from the `mocks/` subdirectory) of the `.json` file will be the URL path the of the mock.
4. run `npm run mocks`.

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

## Use

Satire provides a javascript API and a command line interface. Both may be configured using command line arguments, environment variables, properties in `package.json`, and `.${name}-rc` files (using [configr8](https://www.npmjs.com/package/configr8)). In addition, settings can be passed directly to the javascript API.

### Settings

#### port

**type:** `Integer`

**default:** `0`

The port you would like `satire` to listen on. `0` will select an open port. Positive integers will attempt to listen on the specified port. Negative integers will prevent `satire` from attempting to automatically start listening.

#### mocks

**type:** `String`, `Object` or `Array` of the same

**default:** `['./mocks/**/*', './test/mocks/**/*']`

If a `String`, a glob pattern indicating where mock definitions can be found on the file system.

If an `Object`, it must contain a `path` key indicating the URI to respond to and a `mock` key containing a [mock definition](#mock-definition).

#### watch

**type:** `Boolean`|`String`|`Object`|`Function`

**default:** true

Indicates whether and how to watch the mocks found on the filesystem for changes.

If `false`, just load the mock definitions on startup and do not watch for changes.

If `true`, use the included filesystem watcher to watch for changes.

If a `String`, attempt to `require()` the module the string specifies. This module should export a `Function` watcher.

If an `Object`, attempt to `require()` the module specified by the `module` property and `bind()` any arguments in an `Array` under the `args` property to the `Function` returned by the module. The result should be a `Function` watcher.

If a `Function`, it should have the signature `makeWatcher(mockGlobs)`. `mockGlobs` will be an `Array`. The function should return an `EventEmitter` which emits these events:

+ `.on('all', eventType, filepath)` - indicates that a mock definition on the filesystem has been added, updated, or removed. The mock definition will then be loaded or reloaded. If it doesn't exist, it will be removed.
+ `.on('error', error)` - indicates that the watcher encountered an error. The error will be re-emitted on the satire http server.
+ `.on('ready')` - indicates that the watcher is finished reporting (via `all`) the mock definitions found on the filesystem.

Additionally, the returned `EventEmitter` should have a `.close()` method which will cause the watcher to stop watching the filesystem for changes and allow the process to potentially exit.

#### proxyAPIs

**type:** `Object`

**default:** undefined

Keys that begin with a `"/"` will be used to create a `RegExp` that searches for the key at the begining or the request URL. The first such `pattern` to match will be used. The value of this key should be one of:

+ a `template` string used to create the target URL for the proxy using [`requestUrl.replace(pattern, template)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace).
+ a `Function` which take a `RegExp` pattern - the one that defines the proxy route - and a standard [Node http `request` `IncomingMessage`](https://nodejs.org/api/http.html#http_class_http_incomingmessage). This function should return an object containing a `url` and other options accepted by the [`request`](https://github.com/request/request) module.
+ an `Object` with a `module` property indicating a module to be required. This module should export a `Function` that is passed the proxy object and returns a proxy `template` or `Function`.

Proxy APIs have a lower priority than any mock definitions that would match the same url.

### Javascript API

#### satire(options)

Satire exports a function to allow it to be used within your javascript program. This function will return a standard Node http server which has been set up to handle requests.

##### options

###### argv

**type:** Boolean

**default:** `true`

Indicates whether or not Satire should read configuration settings from `process.argv`

###### name

**type:** String

**default:** `"satire"`

A configuration name used to look up settings in environment variables, properties in `package.json`, and `.${name}-rc` files (using [configr8](https://www.npmjs.com/package/configr8)).

###### settings

**type:** Object

**default:** `undefined`

A set of configuration overrides to apply. These will override any settings found through other means.

~~~javascript
const satire = require('satire');

const server = satire({
	argv: true,
	name: 'my-satire-mocks',
	settings: {
	  port: 5050,
	  mocks: './mocks/**/*'
	  // ...
	}
})
  .on('mock-globs', (globs) => console.log(`Mock globs: ${JSON.stringify(globs, null, 2)}`) )
  .on('listening', (err) => {
    const {
      port
    } = server.address();
    console.log(`Listening on ${port}`);
  })
  .on('mock-start', ({ req, res }) => {
    const start = process.hrtime();
    console.log(`${req.method} ${req.url}`);

    res.on('mock-end', ({ type, req, res }) => {
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
~~~

### Command Line

~~~bash
$ satire --port 5050 --mocks "./test/mocks/**/*"
~~~

<a name="mock-definition"></a>
### Mock Definitions

Mock definitions in javascript take 1 of 4 forms:

+ a `Function` that takes an options argument with `url`, `location`, `request`, and `response` properties
+ a "mock descriptor" - an `Object` with ONLY `request` and `response` keys
+ anything that can `JSON.stringify()`
+ an `Array` containing any of the above

Mock definitions on the filesystem may be:

+ a Common JS module that exports one of the above javascript mock definitions
+ a `.json` file which will `JSON.parse()` to one of the above definitions
+ ANY file, the binary contents of which will be loaded in to a "mock descriptor" object matching a GET request and supplying a content-type header (based on the file extention) and response body containing the data.

The standard "mock descriptor" created for arbitrary files looks like this:

~~~javascript
request: {
    method: 'GET'
},
response: {
    headers: {
        'content-type': mime.getType(forMockPath)
    },
    body: data
}
~~~

* Please note that this does not attempt to limit matching a request by an `Accepts` request header.

#### Function mocks

A `Function` mock takes an `options` argument with `url`, `location`, `request`, and `response` properties.

+ `url` - the `url.parse()`d `request.url`
+ `location` - the relative filesystem path where the mock definition was found. The can sometimes be useful because `Function` mocks can match for any path *under* their own.
+ `request` - a standard [Node http `request` `IncomingMessage`](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
+ `response` - a standard [Node http `response`](https://nodejs.org/api/http.html#http_class_http_serverresponse)

A `Function` mock is the most flexible but least defined type of mock definition. At its simplest it looks something like this:

~~~javascript
module.exports = function ({ request: req, response: res }) {
    res.write('a function module');
    res.end();
};
~~~

If a `Function` mock returns an `Array` with the string `next` as it's first element Satire will continue look for mocks. Otherwise it will assume that the mock matched and handled the request.

The [`test/mocks/`](./test/mocks) directory contains a number of examples of this type of mock

+ [`a-fn-module/`](./test/mocks/a-fn-module/index.js) - the simple function module described above
+ [`post-file/`](./test/mocks/post-file/index.js) - a function module that saves a posted file to it's directory. This is used to test filesystem watching. It isn't at all secure; don't just copy and paste it.
+ [`slow-echo/`](./test/mocks/slow-echo/index.js) - reads a header from the request to determine a timeout after which it will respond with the request headers and body.
+ [`throws/`](./test/mocks/throws/index.js) - this one just throws an error. It's useful to testing error handling.

`Function` mocks take precedence over any files in subdirectories under them, allowing the function mock to define how such files are accesed.

#### Mock Descriptors

A mock descriptor is an object with ONLY `request` and `response` properties. The `request` property contains a predicate against which the incoming request is matched.

The `request` predicate is compared against the request using these rules:

+ Descend in to `Objects`. All keys defined in the predicate must match.
+ All items in an `Array` must match
+ Regular Expressions use [`RegExp.test()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test)
+ Functions should return `true` or `false`
+ All other types must be exactly equal

The request to be matched is a standard [Node http `request` `IncomingMessage`](https://nodejs.org/api/http.html#http_class_http_incomingmessage). The predicate may match the `url` as a `String` or a parsed [URL object](https://nodejs.org/api/url.html#url_legacy_urlobject).


The `response` object describes the response, including `headers`, `statusCode`, `statusMessage`, `timeToRespond`, and `body`.

An example mock descriptor looks like this:

~~~javascript
{
    request: {
        method: /GET|POST/i,
        headers: [
            ({ accept }) => /json/.test(accept),
            ({ authorization }) => /^Bearer\s/.test(authorization),
        ]
    },
    response: {
        headers: {
            "Content-Type": "application/json"
        },
        statusCode: 200,
        body: {
            imaginary: true,
            value: 2
        }
    }
}
~~~

#### JSON mocks

A `.json` file will be read and parsed from the filesystem. If it contains a "mock descriptor" it will be treated as such (see [`./test/mocks/json/test-req-res.json`](./test/mocks/json/test-req-res.json) for an example.) Otherwise, the parsed `Object` will be returned directly as the mock API response since it is, by definition, capable of being `JSON.stringify()`ed. An exmple can be seen in [`./test/mocks/json/test.json`](./test/mocks/json/test.json).

#### Arrays of mocks

Sometimes you want to handle multiple types of requests at the same URI, diferentiating requests by method, headers, cookies, etc. An `Array` mock allows you to create a mock definition for each of these scenarios. The first mock definition in the array that matches will be used.

## License

Copyright (c) 2017 Aaron Madsen

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.