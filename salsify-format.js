'use strict'
const clone = require('clone')

// Return asset URLs
const getAssets = require('./salsify-assets')

// Formats keys and gets image links
module.exports = (formatting, obj) => {
	obj = clone(obj)

	const output = {}
	let i
	if(formatting.keys){
		for(i in formatting.keys){
			if(typeof formatting.keys[i] === 'string'){
				if(formatting.keys[i] in obj){
					output[i] = replaceEntities(obj[formatting.keys[i]])
				}
			}
			else if(formatting.keys[i].property in obj){
				output[i] = replaceEntities(obj[formatting.keys[i].property])
				if(formatting.keys[i].formatting){
					const type = typeof formatting.keys[i].formatting
					if(type === 'string'){
						if(formatting.keys[i].formatting === 'number'){
							let cur = output[i]
							try{
								cur = parseInt(cur)
							}
							catch(e){
								console.error(e)
							}
							output[i] = cur
						}
						else if(formatting.keys[i].formatting === 'unformatCurrency'){
							let cur = output[i]
							try{
								cur = cur.replace('$', '')
								cur = parseInt(cur)
							}
							catch(e){
								console.error(e)
							}
							output[i] = cur
						}
					}
					else if(type === 'function'){
						output[i] = formatting.keys[i].formatting(output[i])
					}
				}
			}



		}
	}
	if(formatting.images){
		if(typeof formatting.images === 'string'){
			formatting.images = [formatting.images]
		}
		for(i = formatting.images.length; i--;){
			if(formatting.images[i] in output){
				output[formatting.images[i]] = getAssets(output[formatting.images[i]], obj)
			}
		}
	}
	return output
}


// Replaces non-utf entities
const Entities = require('html-entities').XmlEntities
const entities = new Entities()
function replaceEntities(input){
	const t = typeof input
	if(t === 'string'){
		return entities.encodeNonUTF(input)
	}
	else if(t === 'number'){
		return input
	}
	else if(Array.isArray(input)){
		for(let i = input.length; i--;){
			input[i] = replaceEntities(input[i])
		}
	}
	else{
		for(let i in input){
			input[i] = replaceEntities(input[i])
		}
	}
	return input
}
