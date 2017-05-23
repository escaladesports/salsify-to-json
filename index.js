'use strict'
require('dotenv').config({ silent: true })
module.exports = (config, cb, options = {}) => {
	if(!config.salsifyJson){
		if(typeof cb === 'function') cb()
		return
	}
	if(typeof cb === 'object'){
		if(typeof options === 'function'){
			const fn = options
			options = cb
			cb = fn
		}
		else{
			options = cb
		}
	}

	// Defaults
	options = Object.assign({
		srcPath: config.src,
		publicPath: config.dist,
		jsonPath: config.json,
		imagePath: config.img,
		jsonSpaces: '\t',
		imgTemp: 'temp-salsify-images',
		apiKey: process.env.SALSIFY_API_KEY,
		all: false,
		requestOptions: {
			timeout: 120 * 1000,
			encoding: null
		}
	}, options)
	const fs = require('fs-extra')
	const glob = require('glob-all')
	const request = require('request')
	const requestProgress = require('request-progress')
	const sharp = require('sharp')
	const imagemin = require('imagemin')
	const imageminMozjpeg = require('imagemin-mozjpeg')
	const imageminPngquant = require('imagemin-pngquant')
	const imageminGifsicle = require('imagemin-gifsicle')
	const imageMinOptions = {
		plugins: [
			imageminMozjpeg(),
			imageminPngquant(),
			imageminGifsicle()
		]
	}
	const cwd = process.cwd()
	const salsify = require('./salsify-download')(options.apiKey)
	const schema = require(`${cwd}/${options.srcPath}/_salsify-schema`)
	let salsifyLastRun
	try{
		salsifyLastRun = require(`${cwd}/${options.srcPath}/salsify-last-run.json`)
	}
	catch(e){
		console.log(e)
		salsifyLastRun = {
			imageProperties: '',
			processImages: '',
			timestamps: {}
		}
	}


	// Objects shared between statements
	const product = {}
	const productFiles = {}
	const categoryFiles = {}
	const imageFiles = {}
	const imgLinks = {}
	const imgObjs = []
	const ignoreImgFiles = {}

	// Get all data from Salsify
	const getPromises = []
	for(let i = schema.categories.length; i--;){

		for(let ii = schema.categories[i].products.length; ii--;){
			const prod = schema.categories[i].products[ii]

			if(typeof prod !== 'object'){
				getPromises.push(new Promise((resolve, reject) => {
					salsify.get(prod, (err, res) => {
						if(err){
							console.log('Error getting ' + prod)
							console.log(err)
						}
						product[prod] = res || {}
						resolve()
					})
				}))
			}
			else{
				for(let i = prod.length; i--;){
					getPromises.push(new Promise((resolve, reject) => {
						salsify.get(prod[i], (err, res) => {
							if(err){
								console.log('Error getting ' + prod[i])
								console.log(err)
							}
							product[prod[i]] = res || {}
							resolve()
						})
					}))
				}
			}
		}


	}

	// Create filtered objects
	function createProductData(){
		return new Promise((resolve, reject) => {

			const prodFormatting = Object.assign({
				keys: schema.productProperties
			}, schema)
			const catFormatting = Object.assign({
				keys: schema.categoryProperties
			}, schema)
			const altProdFormatting = schema.alternateProductProperties ? Object.assign({
				keys: schema.alternateProductProperties
			}, schema) : prodFormatting
			const altCatFormatting = schema.alternateCategoryProperties ? Object.assign({
				keys: schema.alternateCategoryProperties
			}, schema) : catFormatting

			// Create product file data
			for(let i in product){
				imageFiles[i] = {}

				// Loop through image properties to be saved
				if(schema.imageProperties){
					imgLinks[i] = {}
					for(let ii in schema.imageProperties){
						const ids = product[i][schema.imageProperties[ii]]
						if(ids){
							imgLinks[i][ii] = salsify.getAssets(ids, product[i], true)
						}
					}
				}
			}

			// Create category file data
			for(let i = 0; i < schema.categories.length; i++){
				const catId = schema.categories[i].id

				const arr = []
				// Loop through product
				for(let ii = 0; ii < schema.categories[i].products.length; ii++){


					// If a single product
					const prodId = schema.categories[i].products[ii]
					if(typeof prodId !== 'object'){
						const id = prodId
						const lowerId = id.toLowerCase()

						// Create product file data
						productFiles[id] = salsify.format(prodFormatting, product[id])
						productFiles[id].id = id
						productFiles[id].lowerId = id.toLowerCase()
						productFiles[id].categoryId = catId

						// Create category file data
						arr[ii] = salsify.format(catFormatting, product[id])
						arr[ii].id = id
						arr[ii].lowerId = lowerId
					}




					// If there are alternate types of this product
					else{

						// Create category file data
						const firstId = prodId[0]
						arr[ii] = salsify.format(catFormatting, product[firstId])
						arr[ii].id = firstId
						arr[ii].lowerId = firstId.toLowerCase()
						const categoryAlt = []

						const ids = schema.categories[i].products[ii]
						// Loop through product ids
						for(let iii = 0; iii < ids.length; iii++){


							// Populate with sub products
							const mainProduct = {}
							const alternateProduct = []
							for(let iiii = 0; iiii < ids.length; iiii++){
								const id = ids[iiii]
								const lowerId = id.toLowerCase()

								const main = salsify.format(prodFormatting, product[id])
								main.id = id
								main.lowerId = lowerId
								main.categoryId = catId
								mainProduct[id] = main

								const sub = salsify.format(altProdFormatting, product[id])
								sub.id = id
								sub.lowerId = lowerId
								sub.categoryId = catId
								alternateProduct.push(sub)
							}
							for(let id in mainProduct){
								const altArr = []
								for(let i in alternateProduct){
									if(alternateProduct[i].id !== id){
										altArr.push(alternateProduct[i])
									}
								}
								mainProduct[id].alternate = altArr
								productFiles[id] = mainProduct[id]
							}


							// Create category file data for sub product
							if(iii !== 0){
								const id = prodId[iii]
								const lowerId = id.toLowerCase()
								const data = salsify.format(altCatFormatting, product[id])
								data.id = id
								data.lowerId = lowerId
								categoryAlt.push(data)
							}
						}
						arr[ii].alternate = categoryAlt
					}
				}
				categoryFiles[catId] = {
					products: arr
				}
				// Load in additional properties
				for(let prop in schema.categories[i]){
					if(prop !== 'products'){
						categoryFiles[catId][prop] = schema.categories[i][prop]
					}
				}
				// Create category name if doesn't exist
				if(!('name' in categoryFiles[catId])){
					categoryFiles[catId].name = capFirstLetters(catId)
				}

			}

			resolve()
		})
	}
	function capFirstLetters(str){
		str = str.split(' ')
		for(let i = str.length; i--;){
			str[i] = str[i].charAt(0).toUpperCase() + str[i].substring(1)
		}
		return str.join(' ')
	}

	function processAllImages(){
		if(!schema.imageProperties || !schema.processImages){
			return resolve()
		}

		// Determine if we need to process all images or not
		let processAll = false
		const imageProperties = JSON.stringify(schema.imageProperties)
		const processImages = JSON.stringify(schema.processImages)
		if(
			options.all === true ||
			salsifyLastRun.imageProperties != imageProperties ||
			salsifyLastRun.processImages != processImages
		){
			salsifyLastRun.imageProperties = imageProperties
			salsifyLastRun.processImages = processImages
			processAll = true
		}

		let p = Promise.resolve()

		// Loop through products
		for(let prodId in imgLinks){
			// Loop through image types
			for(let imgType in imgLinks[prodId]){
				if(!(imgType in salsifyLastRun)) salsifyLastRun[imgType] = {}
				if(!imgLinks[prodId][imgType]) continue
				for(let imgId = imgLinks[prodId][imgType].length; imgId--;){
					const link = imgLinks[prodId][imgType][imgId].url
					const timestamp = imgLinks[prodId][imgType][imgId].timestamp
					if(
						processAll ||								// If we are processing everything
						!(link in salsifyLastRun[imgType]) ||		// If image has never been downloaded
						salsifyLastRun[imgType][link] != timestamp	// If image has been updated
					){
						salsifyLastRun[imgType][link] = timestamp
						// Promise chain for processing the image
						const imgObj = {
							link: link,
							timestamp: timestamp,
							type: imgType,
							id: prodId,
							imgId: imgId,
							ext: link.split('.').pop()
						}
						imgObj.fileName = `${imgObj.type}/${imgObj.id}-${imgObj.imgId}.${imgObj.ext}`.toLowerCase()
						p = p.then(downloadImage(imgObj))
							.then(processImage)
							.then(minifyImages)
							.then(saveImages)
					}
					// If the image is staying the same
					else{
						ignoreImgFiles[prodId] = true
						try{
							imageFiles[prodId] = require(`${cwd}/${options.publicPath}/${options.jsonPath}/images/${prodId.toLowerCase()}.json`)
						}
						catch(e){
							imageFiles[prodId] = {}
						}
					}
				}
			}


		}
		return p
	}


	// Downloads & processes a single link
	function downloadImage(imgObj){
		return function(){
			return new Promise((resolve, reject) => {
					console.log('Getting: ' + imgObj.link)
					requestProgress(
						request.get(imgObj.link, options.requestOptions, (err, res, data) => {
							console.log(`Downloaded: ${imgObj.link}`)
							if(err) reject(err)
							else if(data){
								imgObj.buffer = data
								resolve(imgObj)
							}
							else reject()
						})
					)
					.on('progress', stat => {
						console.log(`${Math.floor(stat.percent * 100)}%`)
						if(stat.time.remaining){
							console.log(`Remaining: ${stat.time.remaining} seconds`)
						}
					})
				})
		}

	}


	// Processes a single image, splits into multiple versions
	function processImage(origImgObj){
		const promises = []
		for(let i in schema.processImages[origImgObj.type]){
			const imgSchema = schema.processImages[origImgObj.type][i]
			imgSchema.name = i
			const imgObj = Object.assign({}, origImgObj)
			imgObjs.push(imgObj)
			promises.push(new Promise((resolve, reject) => {
				console.log(`Resizing: ${imgObj.fileName}`)
				let img = sharp(imgObj.buffer)
					.resize(imgSchema.width, imgSchema.height)

				/*
				if(imgSchema.filetype){
					img = img
						.background('white')
						.flatten()
						.toFormat(imgSchema.filetype === 'jpg' ? 'jpeg' : imgSchema.filetype)
				}
				*/
				if(!imgSchema.crop){
					img = img
						.background(imgSchema.background || 'white')
						.embed()
				}
				img.toBuffer(toBuffer)
				function toBuffer(err, buffer){
					if(err){
						return reject(err)
					}
					imgObj.buffer = buffer
					imgObj.schema = imgSchema
					imgObj.path = `/${options.imagePath}/${imgObj.type}/${imgSchema.prepend || ''}${imgObj.id}-${imgObj.imgId}${imgSchema.append || ''}.${imgSchema.filetype || imgObj.ext}`.toLowerCase()
					resolve(imgObj)
				}

			}))
		}
		return Promise.all(promises)
	}
	// Minifies multiple versions of a single image
	function minifyImages(arr){
		const promises = []
		for(let i = arr.length; i--;){
			const imgObj = arr[i]
			promises.push(new Promise((resolve, reject) => {
				console.log(`Minifying: ${imgObj.fileName}`)
				imagemin.buffer(imgObj.buffer, imageMinOptions)
					.then(res => {
						imgObj.buffer = res
						resolve(imgObj)
					})
					.catch(reject)
			}))
		}
		return Promise.all(promises)
	}
	// Saves multiple versions of a single image
	function saveImages(arr){
		const promises = []
		for(let i = arr.length; i--;){
			const imgObj = arr[i]
			promises.push(new Promise((resolve, reject) => {
				console.log(`Saving: ${imgObj.path}`)
				fs.outputFile(`${cwd}/${options.publicPath}${imgObj.path}`, imgObj.buffer, err => {
					if(err) reject(err)
					else{
						console.log(`Saved: ${imgObj.path}`)
						resolve()
					}
				})
			}))
		}
		return Promise.all(promises)
	}



	// Saves image link info to JSON objects
	function imagesToJson(){
		// Images to products JSON
		for(let i = imgObjs.length; i--;){
			const obj = imgObjs[i]
			const file = imageFiles[obj.id]
			// Create image type
			if(!(obj.type in file)) file[obj.type] = []

			// Create image id
			if(!file[obj.type][obj.imgId]) file[obj.type][obj.imgId] = {}

			// Add image to file
			const t = parseInt((new Date(obj.timestamp).getTime() / 1000).toFixed(0))
			file[obj.type][obj.imgId][obj.schema.name] = `${obj.path}?${t}`
		}
	}



	// Save additional category properties to JSON file
	function additionalCategoryProperties(){
		for(let i = schema.categories.length; i--;){
			const obj = schema.categories[i]
			const file = categoryFiles[obj.id]
			for(let i in obj){
				if(!(i in file)){
					file[i] = obj[i]
				}
			}

		}
	}



	// Populate empty image files with properties just in case
	function processEmptyImageFiles(){
		for(let i in imageFiles){
			const imgFile = imageFiles[i]
			for(let key in schema.imageProperties){
				if(!(key in imgFile)){
					imgFile[key] = []
				}
			}
		}
	}


	// Put images in product and category files
	function imagesToProduct(){
		console.log('imagesToProduct()')
		for(let i in productFiles){
			if(i in imageFiles){
				productFiles[i].images = imageFiles[i]
			}
		}
		for(let i in categoryFiles){
			const products = categoryFiles[i].products
			for(let i = products.length; i--;){
				const product = products[i]
				if(product.id in imageFiles){
					product.images = imageFiles[product.id]
				}
			}
		}
	}


	// Change timestamps if needed
	function changeTimestamps(){
		console.log('Changing timestamps...')
		for(let i in productFiles){
			const replacement = productFiles[i]
			let original = {}
			try{
				original = require(`${cwd}/${options.publicPath}/${options.jsonPath}/product/${productFiles[i].lowerId}.json`)
			}
			catch(e){}
			// Check for differences
			for(let i in replacement){
				if(original[i] !== replacement[i] && !(i in schema.ignoreModifiedDate)){
					replacement.lastModified = new Date().toISOString()
					break
				}
			}
		}
		for(let i in categoryFiles){
			const replacement = categoryFiles[i]
			let original = {}
			try{
				original = require(`${cwd}/${options.publicPath}/${options.jsonPath}/category/${categoryFiles[i].id}.json`)
			}
			catch(e){}
			let found = false
			for(let prod = replacement.length; prod--;){
				for(let i in replacement[prod]){
					if(!original[i]){
						replacement.lastModified = new Date().toISOString()
						found = true
						break
					}
					if(original[prod][i] !== replacement[prod][i] && !(i in schema.ignoreModifiedDate)){
						replacement.lastModified = new Date().toISOString()
						found = true
						break
					}
				}
				if(found) break
			}
		}
	}


	// Write files
	function writeProduct(){
		console.log('Writing JSON files')
		const promises = []

		// Write product data to file
		for(let i in productFiles){
			promises.push(new Promise((resolve, reject) => {
				fs.outputJson(`${cwd}/${options.publicPath}/${options.jsonPath}/product/${productFiles[i].lowerId}.json`, productFiles[i], { spaces: options.jsonSpaces }, err => {
					if(err) reject(err)
					else resolve()
				})
			}))
		}

		// Write image data to file
		for(let i in imageFiles){
			if(!(i in ignoreImgFiles)){
				promises.push(new Promise((resolve, reject) => {
					fs.outputJson(`${cwd}/${options.publicPath}/${options.jsonPath}/images/${productFiles[i].lowerId}.json`, imageFiles[i], { spaces: options.jsonSpaces }, err => {
						if(err) reject(err)
						else resolve()
					})
				}))
			}
		}

		// Write category data to file
		for(let cat in categoryFiles){
			const catStr = cat.toLowerCase()
			promises.push(new Promise((resolve, reject) => {
				fs.outputJson(`${cwd}/${options.publicPath}/${options.jsonPath}/category/${catStr}.json`, categoryFiles[cat], { spaces: options.jsonSpaces }, err => {
					if(err) reject(err)
					else resolve()
				})
			}))
		}

		// Write all categories to file
		const categoriesFile = []
		for(let i = schema.categories.length; i--;){
			const id = schema.categories[i].id
			categoriesFile[i] = categoryFiles[id]
		}
		promises.push(new Promise((resolve, reject) => {
			fs.outputJson(`${cwd}/${options.publicPath}/${options.jsonPath}/categories.json`, categoriesFile, { spaces: options.jsonSpaces }, err => {
				if(err) reject(err)
				else resolve()
			})
		}))


		// Log image info
		promises.push(new Promise((resolve, reject) => {
			fs.outputJson(`${cwd}/${options.srcPath}/salsify-last-run.json`, salsifyLastRun, { spaces: options.jsonSpaces }, err => {
				if(err) reject(err)
				else resolve()
			})
		}))

		return Promise.all(promises)
	}



	Promise.all(getPromises)
		.then(createProductData)
		.then(processAllImages)
		.then(imagesToJson)
		.then(additionalCategoryProperties)
		.then(processEmptyImageFiles)
		.then(imagesToProduct)
		.then(changeTimestamps)
		.then(writeProduct)
		.then(() => {
			console.log('Done!')
			if(typeof cb === 'function') cb()
		})
		.catch(e => {
			console.error(e)
			if(typeof cb === 'function') cb()
		})
}
