const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHTED EXCEPTION 💥 Shutting Down......');
  console.log(err.name, err.message);
  process.exit(1);
});

const app = require('./app');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DB_PASSWORD);

mongoose
  // .connect(process.env.DATABASE_LOCAL, {
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB Connection successfull'));
//.catch(err => console.log(`DB Connection FAILED beacuse of : ${err}`))

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}....`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNCAUGHT REJECTION 💥 Shutting Down......');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED.Shutting Down.👋');
  server.close(() => {
    console.log('Process terminated 💥');
  });
});

//  console.log(x);
