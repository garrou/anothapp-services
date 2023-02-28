const cors = require('cors');
const express = require('express');
const app = express();

const config = require('./config/config.json');
const authController = require('./controllers/authController');
const homeController = require('./controllers/homeController');
const profileController  = require('./controllers/profileController');
const searchController = require('./controllers/searchController');
const seasonController = require('./controllers/seasonController');
const showController = require('./controllers/showController');
const statController = require('./controllers/statController');

const { checkJwt } = require( './middlewares/guard');

app.use(cors({
    origin: config.ORIGIN,
    allowedHeaders: ['Authorization', 'Content-Type']
}));
app.use(express.json());

app.use('/api/intro', homeController);
app.use('/api/auth', authController);
app.use('/api/profile', checkJwt, profileController);
app.use('/api/search', checkJwt, searchController);
app.use('/api/shows', checkJwt, showController);
app.use('/api/seasons', checkJwt, seasonController);
app.use('/api/stats', checkJwt, statController);

app.listen(config.PORT);