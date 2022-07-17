const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cors = require('cors');
// const admin = require('firebase-admin');

// const serviceAccount = require('./service-account.json');
const AppError = require('./utils/appError');
const errorHandler = require('./controllers/errorController');
const baseRouter = require('./routes/baseRoutes');
const userRouter = require('./routes/userRoutes');
const uploadRouter = require('./routes/uploadRoutes');

// Global Middlewares
const app = express();

app.enable('trust proxy');

// Implement CORS
app.use(cors());

app.options('*', cors());

// Set security HTTP headers
app.use(helmet());

//Developement Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev')); //morgan('tiny')
}
// Limit the number of requests
const limiter = rateLimit({
  max: 500,
  windowms: 60 * 60 * 1000,
  message: 'Too many requests from this IP,please try again in an hour!',
});

app.use('/api', limiter);

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: 'https://optimiz-28df2.firebaseio.com',
// });

// BodyParser ,reading data from body into req.body
app.use(express.json());
// If you want to limit the request size
//app.use(express.json({ limit: '10kb' }));

// Data sanitization againt  NoSql Query Injection
app.use(mongoSanitize());

// Data sanitization againt XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'role',
      'designation',
      'organization',
      'plot_size',
      'construction_area',
      'startDate',
      'completionDate',
      'owner',
      'project_type',
    ],
  })
);
// TODO: Static Files
// const __currentdir = path.resolve();
// Serving static files
// app.use(express.static(`${__dirname}/public`));

app.use(compression());

// test middleware to get time of request
app.use((req, res, next) => {
  req.requestTime = new Date().toLocaleString('en-IN');
  next();
});

//
app.use('/api/v1/test', baseRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/upload', uploadRouter);

if (process.env.NODE_ENV === 'production') {
  // app.use(express.static(`${__currentdir}/frontend/build`));
  app.use(express.static(`${__dirname}/public`));

  app.get('*', (req, res, next) => {
    // res.sendFile(path.resolve(__currentdir, 'frontend', 'build', 'index.html'));
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
  });
}

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server.`, 404));
});

app.use(errorHandler);

module.exports = app;
// git add -A

// git add models/userModel.js

// git commit -m ""

// git push heroku main
