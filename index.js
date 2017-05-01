'use strict'
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const tcpCrypto = require('tcp-crypto');

let dir = __dirname + '/protocols/';
let protocols = fs.readdirSync(dir).reduce((r, f) => {r[path.parse(f).name] = require(dir + f); return r}, {});

let config = Object.assign({},
	JSON.parse(fs.readFileSync(__dirname + '/config.json')), 
	process.argv.splice(process.execArgv.length + 2)
		.map((e) => e.split('='))
		.reduce(function (res, e) {
			try {
				res[e[0]] = JSON.parse(e[1]); 
			} catch (err) {
				res[e[0]] = e[1]; 
			}
			return res;
		}, {}));
let devices = fs.existsSync(__dirname + '/cache.json') ? JSON.parse(fs.readFileSync(__dirname + '/cache.json')) : {};
let cacheDevices = () => fs.writeFile(__dirname + '/cache.json', JSON.stringify(devices, null, '\t'), (err) => console.log(err ? err : `Cache updated: ${Object.keys(devices).length} devices \n`));

function debug() {
	if (config.debug)	
		console.log.apply(this, arguments);
}

debug(config);

let agent = new tcpCrypto.Server(config);
let timers = {};
let idleTimer;

if (!config['no-cache'])
	idleConnection();

let catcher_list = config['catcher-list'];
if (catcher_list && catcher_list instanceof Array && catcher_list.length > 0) {
	catcher_list.forEach(function (opts) {
		let catcher = child_process.spawn(opts.command, opts.args, opts.options);
		debug(`Catcher ${opts.name} running`);
	
		var re = new RegExp(opts.regexp);
	
		function onData(data) {
			var res = re.exec(data);
			if (!res)
				return;
			
			debug(`${opts.name} catch: `, data.toString());
		
			for (let device_id in devices) {
				let device = devices[device_id];
				if (device.protocol != opts.protocol || !device.protocol_params || device.protocol_params.ip != res[1] || !protocols[device.protocol])
					continue;
	
				queryValues(device);						
			}
		} 
		
		catcher.stdout.on('data', onData);
		catcher.stderr.on('data', onData);
		catcher.on('close', function(code) {
			console.error(`Catcher ${opts.name} crashed with code ${code}`);
			process.exit(1);
		});	

	})
}

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
		agent.send('GET-VALUE', res instanceof Error ? 'ERR: ' + res.message : res[0].value, msg_id);
	});
});

agent.on('DO-ACTION', function (data, msg_id) {
	if (!protocols[data.protocol])	
		return agent.send('DO-ACTION', 'unsupported protocol: ' + data.protocol, msg_id);

	protocols[data.protocol].doAction(data.protocol_params, data.action, function (err) {
		agent.send('DO-ACTION', err, msg_id);

		if (!err && devices[data.device_id])
			polling(devices[data.device_id], 0);
	});
});

agent.on('PING', function(ip, msg_id) {
	if (!config.ping || !config.ping.command)
		return agent.send('PING', 'Ping command is not setted', msg_id);

	let proc = child_process.exec(eval(`\`${config.ping.command}\``), eval(`\`${config.ping.options}\``));
	proc.on('error', (err) => agent.send('PING', err, msg_id));
	proc.on('exit', (code) => agent.send('PING', code, msg_id));
})

agent.on('connection', function() {
	console.log('\nConnection open ' + new Date());

	if (idleTimer)
		clearTimeout(idleTimer);

	for (let id in timers)
		clearTimeout(timers[id]);

	devices = {}; // Bag: If server fail after connection then load empty data
});

agent.on('disconnection', function () {
	console.log('Connection close ' + new Date() + '\n');
	if (!!config['no-alone'])
		process.exit(0);
});
agent.on('error', (err) => console.log(err));
agent.on('send', (msg) => debug('SENDED ' + new Date() + '\n', msg, '\n'));

function idleConnection() {
	idleTimer = setTimeout(function() {
		for (let id in devices) 
			polling(devices[id], Math.floor(Math.random() * 3000));
		console.log(`Load local device list (${Object.keys(devices).length}) from cache.json`);
		idleTimer = null;
	}, config.wait_connection || 1000);
}

function queryValues(device, callback) {
	protocols[device.protocol].getValues(
		device.protocol_params, 
		device.varbind_list.map((v) => v.address),
		function (res) {
			debug('getValues done for device ' + device.id);

			agent.send('VALUES', {
				device_id: device.id, 
				time: new Date().getTime(),
				error: res instanceof Error ? res.message : undefined,
				values: !(res instanceof Error) ?  res.reduce(function (r, e, i) {r[device.varbind_list[i].id] = e; return r;}, {}) : undefined
			});

			if (callback)
				callback();
		}
	)
}

function polling(device, delay) {
	if (!device || !device.id)
		return console.error('Error: bad device', device);

	if (timers[device.id]) {
		clearTimeout(timers[device.id]);
		delete timers[device.id];
	}

	if (!devices[device.id] || !device.varbind_list || device.varbind_list.length == 0 || device.protocol == 'none' || device.protocol == 'internal')
		return;

	if (!protocols[device.protocol])
		return console.error('Unsupported protocol: ' + device.protocol);

	if (delay)
		return timers[device.id] = setTimeout(() => polling(device), delay);

	queryValues(device, function () {
		timers[device.id] = setTimeout(
			polling, 
			parseInt(device.protocol_params.period) * 1000 || 10000, 
			device
		);
	});	
}