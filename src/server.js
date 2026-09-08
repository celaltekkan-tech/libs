require('dotenv').config();
const { app, connectDb } = require('./app');


const PORT = process.env.PORT || 4000;


(async () => {
await connectDb();
app.listen(PORT, () => console.log(`Server listening ${PORT}`));
})();