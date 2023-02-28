const { Pool } = require('pg');
const config = require('../config/config.json');

const pool = new Pool({ 
    user: config.POSTGRES_USER,
    host: config.POSTGRES_HOST,
    database: config.POSTGRES_DB,
    password: config.POSTGRES_PASSWORD,
    port: config.POSTGRES_PORT,
    max: 10
});

module.exports = pool;