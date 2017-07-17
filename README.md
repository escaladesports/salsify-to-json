# Salsify to JSON

Fetches Salsify data and saves to JSON files.

## Installation

```bash
yarn add escaladesports/salsify-to-json#v2.0.0
```

## Usage

```js
const salsify = require('salsify-to-json')
salsify({
		ids: [ 'T8681W', 'T1265' ],
		out: './json'
	})
	.then(() => console.log('Done!'))
	.catch(console.error)
```
