'use strict'

// Return asset URLs
module.exports = (ids, obj, timestamp) => {
	let assets = obj['salsify:digital_assets']
	if(typeof ids === 'string') ids = [ ids ]
	const assetL = ids.length
	const output = []
	let found = 0
	for(let i = 0; i < assets.length; i++){
		let index = ids.indexOf(assets[i]['salsify:id'])
		if(index !== -1){
			if(timestamp){
				output[index] = {
					url: assets[i]['salsify:url'],
					timestamp: assets[i]['salsify:updated_at']
				}
			}
			else{
				output[index] = assets[i]['salsify:url']
			}
			found++
			if(found >= assetL){
				return output
			}
		}
	}

}
