const AppError = require('../utils/appError');

const handleCastErrorDb = (err) => {
  const message = `Invalid ${err.path} : ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDb = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDb = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid Input data ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJwtError = () =>
  //console.log(err.name);
  new AppError('Invalid token.Please login again', 401);
const handleTokenExpired = () =>
  new AppError('Your token has expired.Please login again.', 401);

const handleMulterError = (error) => {
  // TODO: Return the correct messages
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError('File too large', 400);
    case 'LIMIT_FILE_COUNT':
      return new AppError('Too many files', 400);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError('Choose correct file type', 400);
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_COUNT':
    default:
      return new AppError('Something went wrong', 400);

    // case 'LIMIT_FIELD_KEY':
    //   return new AppError('Only 10 files allowed', 400);
    // case 'LIMIT_FIELD_VALUE':
    //   return new AppError('Only 10 files allowed', 400);
    // case 'LIMIT_FIELD_COUNT':
    //   return new AppError('Only 10 files allowed', 400);

    // default:
    //   return new AppError('Something went wrong', 400);
  }
};

const sendErrorDev = (err, res) => {
  //console.log(err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};
const sendErrorProd = (err, res) => {
  // Operational trusted errors : send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  //Programming or other unknown error : don't release error details
  else {
    // Log Error
    console.log('Error 💥', err);
    // 2) Send Generic Message
    res.status(err.statusCode).json({
      status: 'error',
      message: 'Something went wrong.',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    // console.log('error', error);
    error.message = err.message;
    if (error.name === 'CastError') error = handleCastErrorDb(error);
    if (error.code === 11000) error = handleDuplicateFieldsDb(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDb(error);
    if (error.name === 'JsonWebTokenError') error = handleJwtError();
    if (error.name === 'TokenExpiredError') error = handleTokenExpired();
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, res);
  }
  next();
};
