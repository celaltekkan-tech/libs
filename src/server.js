require('dotenv').config();
const { app, connectDb } = require('./app');


const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

(async () => {
await connectDb();
app.listen(PORT, HOST, () => console.log(`Server listening ${HOST}:${PORT}`));
})();