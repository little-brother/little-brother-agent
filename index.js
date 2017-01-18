'use strict'
const fs = require('fs');
const path = require('path');
const tcpCrypto = require('tcp-crypto');

if (require.main !== module)
	return module.exports = tcpCrypto.Client;

let dir = __dirname + '/protocols/';
let protocols = fs.readdirSync(dir).reduce((r, f) => {r[path.parse(f).name] = require(dir + f); return r}, {});

let config = Object.assign({},
	JSON.parse(fs.readFileSync(__dirname + '/config.json')), 
	process.argv.splice(process.execArgv.length + 2)
		.map((e) => e.split('='))
		.reduce((res, e) => {res[e[0]] = e[1]; return res;}, {}));
let devices = fs.existsSync(__dirname + '/cache.json') ? JSON.parse(fs.readFileSync(__dirname + '/cache.json')) : {};
let cacheDevices = () => fs.writeFile(__dirname + '/cache.json', JSON.stringify(devices, null, '\t'), (err) => console.log(err ? err : `Cache updated: ${Object.keys(devices).length} devices \n`));

let agent = new tcpCrypto.Server(config);
let timers = {};
let idleTimer;

if (!config['no-cache'])
	idleConnection();

agent.on('UPDATE-LIST', function (device_list) {
	if (device_list.length == 0)
		return;

	device_list.filter((d) => !!protocols[d.protocol]).forEach(function(d) { 
		devices[d.id] = d;
		polling(d, Math.floor(Math.random() * 3000));
	});

	if (!config['no-cache'])
		cacheDevices();
});

agent.on('UPDATE', function (device) {
	devices[device.id] = (device.varbind_list && device.varbind_list.length > 0) ? device : undefined; 
	polling(device);

	if (!config['no-cache'])
		cacheDevices();
});

agent.on('GET-VALUE', function (data, msg_id) {
	if (!protocols[data.protocol])	
		return agent.send('GET-VALUE', 'unsupported protocol: ' + data.protocol, msg_id);

	protocols[data.protocol].getValues(data.protocol_params, [data.address], function (res) {
		res.time = new Date().getTime(); 
		agent.send('GET-VALUE', res[0], msg_id)
	});
});

agent.on('DO-ACTION', function (data, msg_id) {
	if (!protocols[data.protocol])	
		return agent.send('GET-VALUE', 'unsupported protocol: ' + data.protocol, msg_id);

	protocols[data.protocol].doAction(data, function (err){
		if (!err)
			polling(data.device_id);
		agent.send('DO-ACTION', err, msg_id);
	});
});

agent.on('connection', function() {
	console.log('\nConnection open ' + new Date());

	if (idleTimer)
		clearTimeout(idleTimer);

	for (let id in timers)
		clearTimeout(timers[id]);

	devices = {}; // Bag: If server fail after connection then load empty data
});

agent.on('disconnection', () => console.log('Connection close ' + new Date() + '\n'));
agent.on('error', (err) => console.log(err));
agent.on('send', (msg) => console.log('SENDED ' + new Date() + '\n', msg, '\n'));

function idleConnection() {
	idleTimer = setTimeout(function() {
		for (let id in devices) 
			polling(devices[id], Math.floor(Math.random() * 3000));
		console.log(`Load local device list (${Object.keys(devices).length}) from cache.json`);
		idleTimer = null;
	}, config.wait_connection || 1000);
}

function polling(device, delay) {
	if (!device || !device.id)
		return console.log('Error: bad device', device);

	if (timers[device.id]) {
		clearTimeout(timers[device.id]);
		delete timers[device.id];
	}

	if (!device.varbind_list || device.varbind_list.length == 0 || device.protocol == 'none' || device.protocol == 'internal')
		return;

	if (!protocols[device.protocol])
		return console.log('Unsupported protocol: ' + device.protocol);

	if (delay)
		return timers[device.id] = setTimeout(() => polling(device), delay);

	protocols[device.protocol].getValues(
		device.protocol_params, 
		device.varbind_list.map((v) => v.address),
		function (res) {
			console.log('getValues done for device ' + device.id);
			agent.send('VALUES', {
				device_id: device.id, 
				time: new Date().getTime(), 
				values: res.reduce(function (r, e, i) {r[device.varbind_list[i].id] = e; return r;}, {})
			});
			timers[device.id] = setTimeout(polling, parseInt(device.protocol_params.period) * 1000 || 10000, device);
		}
	)		
}