module.exports = {
  apps: [
    {
      name: process.env.APP_NAME || 'minchat-zalo-intermediate',
      script: './src/server.js',
      args: '',
      exec_mode: 'cluster',
      instances: process.env.INSTANCES || 1,
      kill_timeout: 4000,
      wait_ready: false, // bạn có thể để false vì không gọi process.send('ready')
      auto_restart: true,
      watch: false,
      max_memory_restart: '1536M',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      node_args: '--max-old-space-size=2048',
    },
  ],
}
