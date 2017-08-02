'use strict'
const request = require('request')
const fs = require('fs-extra')

function fetchProduct(id, obj){
	return new Promise((resolve, reject) => {
		obj.log(`Fetching ${id} from Salsify...`)
		const url = `https://app.salsify.com/api/v1/products/${id}`
		request({
			url: url,
			method: 'get',
			headers: {
				Authorization: `Bearer ${obj.apiKey}`
			}
		}, (err, res, body) => {
			if(err){
				reject(new Error(err))
			}
			else if(res.statusCode !== 200){
				reject(new Error(`Unexpected status code, ${res.statusCode}, on url: ${url}`))
			}
			else{
				try{
					body = JSON.parse(body)
				}
				catch(e){
					reject(new Error('Could not parse JSON'))
					return
				}
				obj.data[id] = body
				resolve()
			}
		})
	})
}


function saveProduct(id, obj){
	return new Promise((resolve, reject) => {
		obj.log(`Saving Salsify data for ${id}...`)
		let name = obj.lowerCase ? id.toLowerCase() : id
		fs.outputJson(`${obj.out}/${name}.json`, obj.data[id], {
				spaces: obj.pretty ? '\t' : ''
			})
			.then(resolve)
			.catch(reject)
	})
}


function fetchAllProducts(obj){
	return new Promise((resolve, reject) => {
		obj.log('Fetching Salsify data...')
		const promises = []
		for(let i = 0; i < obj.ids.length; i++){
			promises[i] = fetchProduct(obj.ids[i], obj)
		}
		Promise.all(promises)
			.then(() => resolve(obj))
			.catch(reject)

	})
}

function saveAllProducts(obj){
	return new Promise((resolve, reject) => {
		obj.log('Saving Salsify data...')
		const promises = []
		for(let i = 0; i < obj.ids.length; i++){
			promises[i] = saveProduct(obj.ids[i], obj)
		}
		Promise.all(promises)
			.then(() => resolve(obj))
			.catch(reject)
	})
}


module.exports = obj => {
	return new Promise((resolve, reject) => {
		if(Array.isArray(obj)){
			obj = { ids: obj }
		}
		obj = Object.assign({
			apiKey: process.env.SALSIFY_KEY,
			data: {},
			out: './json',
			lowerCase: true,
			pretty: true,
			log: console.log
		}, obj)
		if(!obj.apiKey){
			return obj.log('No Salsify API key found.')
		}
		obj.log('Salsify to JSON...')
		fetchAllProducts(obj)
			.then(saveAllProducts)
			.then(resolve)
			.catch(reject)
	})
}
