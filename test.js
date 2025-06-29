import express from 'express';

const app = express();
const port = 3001;

// Middleware để parse JSON body
app.use(express.json());
// // Middleware để parse URL-encoded body
// app.use(express.urlencoded({ extended: true }));
// // Middleware để log request
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.url}`);
//     next();
// });

app.post('/api/webhook', (req, res) => {
    console.log('Received webhook:', req.body);
    // Xử lý webhook ở đây
    res.status(200).send('Webhook received');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Test webhook at http://localhost:${port}/api/webhook`);
})