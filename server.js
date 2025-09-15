const dotenv = require('dotenv');
const mongoose = require('mongoose');

// ENV CONFIG
dotenv.config({
  path: './config.env',
});

// DECLARATIONS
const app = require('./app');

const PORT = process.env.PORT || 3000;
const dbUri = process.env.DATABASE_URI.replace(
  '<DATABASE_PASSWORD>',
  process.env.DATABASE_PASSWORD
);

// SERVER START
mongoose.connect(dbUri).then(() => {
  console.log(`DATABASE CONNECTION SUCCESSFUL ✅`);
  app.listen(PORT, () => {
    console.log(`${PORT}: SERVER IS LISTENING 👂`);
  });
});
