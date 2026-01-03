import app from "./app.js";
import { initializePool, closePool } from "./config/db.js";

const PORT = process.env.PORT || 5000;

// Initialize Database Pool before starting server
initializePool()
    .then(() => {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`API running on http://172.26.0.111:${PORT}`);
        });

        // Graceful Shutdown
        const shutdown = async () => {
            console.log("Shutting down server...");
            server.close(async () => {
                await closePool();
                process.exit(0);
            });
        };

        server.on('error', (err) => {
            console.error("SERVER ERROR:", err);
            process.exit(1);
        });

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        console.error("Failed to start server (DB Pool Error):", err);
        process.exit(1);
    });

process.on('uncaughtException', (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("UNHANDLED REJECTION:", reason);
});

process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});
