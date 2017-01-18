# Little brother agent

Remote TCP agent for **[Little brother DCIM](https://github.com/little-brother/little-brother-dcim)**. 

## Usage

1. Install agent
  ``` bash
  npm i little-brother-dcim-agent
  ```

2. Install `forever` or `pm2` to provide a permanent application run
  ``` bash
  npm i forever -g
  ```

3. Edit `config.json`

  * **port** - local tcp-port. Default `3000`.
  * **cipher** - encrypt algorithm. Default `aes192`. If `cipher` is not set then data is not encrypted. 
  * **password** - encrypt password. Default `little`.
  * **dir** - message storage while DCIM is not connect. Default `./outbox`. If `dir` is not set then agent don't protect messages by `fs`.
  * **no-cache** - no store local device list in `cache.json` (agent always wait list from server). Default `false`.

4. Run
  ``` bash
  forever start index.js
  ```

  You can override config parameters e.g.  
  ``` bash
  forever start index.js dir="./some-dir" 
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