const { spawn } = require('node:child_process');
const { install, bin, Tunnel } = require('cloudflared');
const wait = require('wait-on');

(async function () {
  try {
    process.env.VERBOSE = 'true';
    await install(bin);
    spawn(bin, ['--version'], { stdio: 'inherit', shell: true });
    await wait({ resources: ['http://localhost:8787'], timeout: 10_000 });

    const tunnel = Tunnel.quick('localhost:8787');
    const url = new Promise((resolve) => tunnel.once('url', resolve));

    // show the url
    const link = await url;
    console.info('LINK:', link);
    // wait for the all 4 connections to be established
    const conn = new Promise((resolve) => tunnel.once('connected', resolve));
    console.info('CONN:', await conn);

    tunnel.on('exit', (code) => {
      console.log('tunnel process exited with code', code);
    });

    process.on('SIGINT', function () {
      console.info('Ctrl-C...');
      tunnel.stop();
      process.exit(0);
    });

    await wait({ resources: [link], timeout: 20_000, verbose: true });
    const response = await fetch(`${link}/install`, { method: 'POST' });
    const data = await response.json();
    console.log('Bot registered', data);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
