# Little brother agent<br />
Remote TCP agent for **[Little brother DCIM](https://github.com/little-brother/little-brother-dcim)**. 

## Usage
1. Install agent<br />
  ``` bash
  npm i little-brother-dcim-agent
  ```
  
2. Install `forever` or `pm2` to provide a permanent application run<br />
  ``` bash
  npm i forever -g
  ```
  
3. Edit `config.json`
  * **port** - local tcp-port. Default `3000`
  * **cipher** - encrypt algorithm. Default `aes192`
  * **password** - encrypt password. Default `little`
  * **dir** - message storage while DCIM is not connect. Default `./outbox`
  
4. Run
  ``` bash
  forever start agent.js
  ```