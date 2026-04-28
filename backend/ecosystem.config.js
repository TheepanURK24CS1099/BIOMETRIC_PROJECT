module.exports = {
  apps: [
    {
      name: 'hostel-attendance-api',
      script: 'server.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 10000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
    {
      name: 'hostel-attendance-device-worker',
      script: 'workers/deviceSyncWorker.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 10000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
}
