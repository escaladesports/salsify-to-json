'use strict'
require('dotenv').config({ silent: true })
const salsify = require('./index')


salsify([ 'T8681W', 'T1265' ])
	.then(() => console.log('Done!'))
	.catch(console.error)
