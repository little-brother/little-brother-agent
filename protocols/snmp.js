'use strict';
const snmp = require('net-snmp');
const ver = {'1' : snmp.Version1, '2c' : snmp.Version2c};

// opts = {version: 2c, community: public, port: 161, timeout: 3}
// address = {oid: 1.3.6.1.2.1.1.3.0}
exports.getValues = function(opts, address_list, callback) {
	if (ver[opts.version] == undefined)
		throw new Error('Unsupported version of snmp: ' + opts.version);

	let session = snmp.createSession (opts.ip, opts.community, {
		port: opts.port, 
		version: ver[opts.version], 
		timeout: opts.timeout * 1000 || 3000
	});

	let res = new Array(address_list.length);
	if (opts.version == 1) {
		function getValue(i) {
			if (i == address_list.length) {
				closeSession(session);
				return callback(res);
			}

			let address = address_list[i].oid; 
			session.get([address], function(err, rows){
				res[i] = {
					value: (err) ? err.message : rows[0].value,
					isError: !!(err)
				};
	
				getValue(i + 1);
			});
		}
	
		getValue(0);
	}

	if (opts.version == '2c') {
		session.get (address_list.map((a) => a.oid), function (err, rows) {
			res = address_list.map(function(address, i) {
				return {
					value:  (err) ? err.message : snmp.isVarbindError(rows[i]) ? snmp.varbindError(rows[i]) : rows[i].value,
					isError: !!(err || snmp.isVarbindError(rows[i]))
				}
			});
			callback(res);
			closeSession(session);
		});
	}
}

// opts = {ip: 128.33.12.34, port: 162, write_community: private, version: 2c, timeout: 3 }
// action = {oid: '1.2.3', type: 2, value: 10}
exports.doAction = function(opts, action, callback) {
	if (ver[opts.version] == undefined)
		throw new Error('Unsupported version of snmp: ' + opts.version);

	let session = snmp.createSession (opts.ip, opts.write_community, {
		port: opts.port, 
		version: ver[opts.version], 
		timeout: opts.timeout * 1000 || 3000
	});

	session.set ([{
		oid: action.oid, 
		type: (action.value_type in snmp.ObjectType) ? snmp.ObjectType[action.value_type] : 2, // 2 - Integer
		value: action.value
		}], 
		function (err, res) {
			closeSession(session);
			callback(err.message);
		}
	);	
}

function closeSession(session) {
	try { 
		session.close(); 
	} catch(err) { 
		console.log('SNMP session close: ', err); 
	}
}