import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export default new pg.Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    max: 20
});