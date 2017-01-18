'use strict'
const http = require('http');

// opts = {hostname: 127.0.0.1, port: 80}
// address = {path: /get/user/15}
exports.getValues = function (opts, address_list, callback) {
	let res = [];
	let options = {
		hostname: opts.hostname,
		port: parseInt(opts.port) || 80,
		method: 'GET'
	};

	function getValue(i) {
		if (i == address_list[i].length)
			return callback(res);

		let address = address_list[i].path;
		options.path = address;
		http.get(options, function (response) {
			let data = '';
			response.on('data', (d) => data += d);
			response.on('error', function (err) {
				res[i] = { 
					value: err.message, 
					isError: true
				};

				getValue(i + 1);
			});

			response.on('end', function() {	
				res[i] = {
					value: data, 
					isError: false
				};

				getValue(i + 1);
			});
		});
	}

	getValue(0);	
}

// ???
exports.doAction = function(opts, action, callback) {
	callback(null);
}