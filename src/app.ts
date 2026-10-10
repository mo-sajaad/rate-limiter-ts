import express from 'express';
import { connectRedis } from './config/redis';
import { createRateLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 3000;

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
});

app.use('/api', apiLimiter);


app.get('/api/resource', (req, res) => {
    res.json({
        message: "Access granted to connected endpoint",
        timestamp: new Date().toString(),
    })
})

async function startServer(){
    await connectRedis();
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    })
}

startServer();