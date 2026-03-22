const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

app.use('/health', require('./routes/health'));
app.use('/tenancy', require('./routes/tenancy'));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const body = { status, error: err.message || 'An unexpected error occurred' };
  if (err.fields) body.fields = err.fields;
  res.status(status).json(body);
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Tenancy service listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
