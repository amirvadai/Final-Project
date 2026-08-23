const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

//

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://amirvadai:amirvadai@cluster0.tjeho4l.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectDB();