'use strict'
const _salsify = {}

// Set/change API key
let _apiKey
module.exports = (key) => {
	_apiKey = key
	return _salsify
}


// Get a single product
_salsify.get = (id, formatting, cb) => {
	if(!cb){
		cb = formatting
		formatting = false
	}
	const request = require('request')
	request({
		url: `https://app.salsify.com/api/v1/products/${id}`,
		method: 'get',
		headers: {
			Authorization: `Bearer ${_apiKey}`
		}
	}, (err, res, body) => {
		if(err){
			cb(err)
		}
		else if(res.statusCode !== 200){
			cb(`Unexpected status code: ${res.statusCode}`)
		}
		else{
			try{
				body = JSON.parse(body)
			//	console.log(body)
			}
			catch(e){
				console.error(e)
				cb('Could not parse JSON')
				return
			}
			if(formatting){
				body = format(formatting, body)
				// Write JSON file
				if(formatting.outputFile){
					const fs = require('fs-extra')
					fs.outputJson(formatting.outputFile, body, { spaces: formatting.space || 0 }, err => {
						if(err) cb(err)
						else cb(false, body)
					})
					return
				}
			}
			cb(false, body)
		}
	})
}





// Return asset URLs
_salsify.getAssets = require('./salsify-assets')

// Formats keys and gets image links
const format = _salsify.format = require('./salsify-format')
