# Little brother agent

Remote TCP agent for **[Little brother DCIM](https://github.com/little-brother/little-brother-dcim)**. 

## Usage

1. Download [latest version](https://github.com/little-brother/little-brother-dcim-agent/archive/master.zip) and unpack to desired folder.

2. Open console, go to unpacked files and run to install 
  ``` bash
  npm i
  ```

3. Install `forever` or `pm2` to provide a permanent application run
  ``` bash
  npm i forever -g
  ```

4. Edit `config.json`

  * **port** - local tcp-port. Default `3000`.
  * **cipher** - encrypt algorithm. Default `aes192`. If `cipher` is not set then data is not encrypted. 
  * **password** - encrypt password. Default `little`.
  * **dir** - message storage while DCIM is not connect. Default `./outbox`. If `dir` is not set then agent don't protect messages by `fs`.
  * **no-cache** - no store local device list in `cache.json` (agent always wait list from server). Default `false`.
  * **debug** - print sended data and other info to console if it's `true`
  * **catcher-list** - catchers for traps
    * **protocol** - serviced protocol
    * **command** - running deamon, eg `snmptrapd`
    * **args** - arguments, eg `["-A", "-n", "-f", "-Lo"]`
    * **options** - optional [options](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options) for command.
    * **regexp** - regexp pattern to get ip address. You can use `\\[(.*?)\\]` to parse snmp trap like below
	* **name** - optional, used by debug. 

      ```
      2017-01-23 23:35:11 UDP: [127.0.0.1]:56632->[0.0.0.0]:0 [UDP: [127.0.0.1]:56632->[0.0.0.0]:0]:DISMAN-EVENT-MIB::sysUpTimeInstance = Timeticks: (3002705848) 347 days, 12:50:58.48     SNMPv2-MIB::snmpTrapOID.0 = OID: SNMPv2-SMI::org.3.3.3.3.3.3    iso.2.2.2.2.2.2 = STRING: "Aliens opened the door"
      ```	

5. Run
  ``` bash
  forever start index.js
  ```

  You can override config parameters e.g.  
  ``` bash
  forever start index.js dir="./some-dir" catcher-list="[{\"protocol\":\"snmp\", \"command\":\"snmptrapd\", \"args\":[\"-A\", \"-n\", \"-f\", \"-Lo\"], \"regexp\":\"\\[(.*?)\\]\", \"name\": \"SNMP\"}]"
  ```

## Messages

  * **UPDATE-LIST** - server sends to agent required device list on connect
  * **UPDATE** - server sends device data when device was updated
  * **GET-VALUE** - sends when user request data from GUI
  * **DO-ACTION** - sends when user push action button on device page
  * **VALUES** - agent sends new polling data grouping by device	

## Roadmap

  * Sync local time and server time on connect
  * Optimize message queue