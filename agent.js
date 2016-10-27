'use strict'
const fs = require('fs');
const Server = require('tcp-crypto').Server;
const protocols = fs.readdirSync('./protocols').reduce((res, file) => {
	let name = file.substr(0, file.lastIndexOf('.'));
	res[name] = require('./protocols/' + name);
	return res;
}, {});

let config = {
	load(filename) {
		let cfg = JSON.parse(fs.readFileSync(filename));
		if (!cfg.device_list)
			cfg.device_list = [];
		Object.assign(this, cfg);
		Object.defineProperty(this, 'filename', {get : () => filename});
		return this; 
	},
	save() {
		fs.writeFile(this.filename, 
			JSON.stringify(config, null, '\t'), 
			(err) => console.log(err ? err : `Config updated with (${Object.keys(config.device_list).length}) devices \n`)
		)
	}
}.load('./config.json');
let agent = new Server(config);
let timers = {};
let idleTimer;

idleConnection();

agent.on('UPDATE-LIST', function (device_list) {
	if (device_list.length == 0) 
		return;

	device_list.filter((device) => !!protocols[device.protocol]).forEach(function(device) { 
		config.device_list[device.id] = device;
		polling(device, Math.floor(Math.random() * 3000));
	});

	config.save();
});

agent.on('UPDATE', function (device) {
	config.device_list[device.id] = (device.varbind_list && device.varbind_list.length > 0) ? device : undefined; 
	polling(device);

	config.save();
});

agent.on('GET-VALUE', function (data, msg_id) {
	if (!protocols[data.protocol])	
		return agent.send('GET-VALUE', 'unsupported protocol: ' + data.protocol, msg_id);

	protocols[data.protocol].getValues(data.protocol_params, [data.address], (res) => agent.send('GET-VALUE', res[0], msg_id));
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
	config.device_list = {}; // Bag: If server fail after connection then load empty data
});

agent.on('disconnection', function() {
	console.log('Connection close ' + new Date() + '\n');
	idleConnection();
});
 
agent.on('error', (err) => console.log(err));
agent.on('send', (msg) => console.log('SENDED ' + new Date() + '\n', msg, '\n'));

function idleConnection() {
	idleTimer = setTimeout(function() {
		for (let id in config.device_list) 
			polling(config.device_list[id], Math.floor(Math.random() * 3000));
		console.log(`Load local device list (${Object.keys(config.device_list).length})`);
		idleTimer = null;
	}, config.wait_connection || 1000);
}

function polling(device, delay) {
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
			console.log('getValues done for id ' + device.id);
			device.varbind_list.forEach((v, i) => agent.send('VALUE', Object.assign({id: v.id}, res[i])));
			timers[device.id] = setTimeout(polling, parseInt(device.protocol_params.period) * 1000 || 10000, device);
		}
	)		
}