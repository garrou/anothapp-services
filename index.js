require('dotenv').config();

const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');

const authController = require('./controllers/authenticationController');
const homeController = require('./controllers/homeController');
const profileController  = require('./controllers/profileController');
const searchController = require('./controllers/searchController');
const seasonController = require('./controllers/seasonController');
const showController = require('./controllers/showController');
const statController = require('./controllers/statController');

const { checkJwt } = require( './middlewares/guard');

const app = express();

app.use(cors({
    credentials: true,
    origin: process.env.ORIGIN
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/intro', homeController);
app.use('/api/auth', authController);
app.use('/api/profile', checkJwt, profileController);
app.use('/api/search', checkJwt, searchController);
app.use('/api/shows', checkJwt, showController);
app.use('/api/seasons', checkJwt, seasonController);
app.use('/api/stats', checkJwt, statController);

app.listen(process.env.PORT);