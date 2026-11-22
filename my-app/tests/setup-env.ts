import { inject } from "vitest";

// Point the app at the in-memory database and use a test-only signing secret.
process.env.MONGO_URL = inject("mongoUri");
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
// Make sure no test can reach real AI / AWS / Microsoft services by accident.
delete process.env.GROQ_API_KEY;
delete process.env.Next_GROP_API_KEY;
delete process.env.NEXT_PUBLIC_BACKEND_URL;
process.env.AWS_S3_BUCKET = "test-bucket";
// Fake credentials: presigned links are computed locally; no request is ever sent to AWS in tests.
process.env.AWS_REGION = "ap-southeast-2";
process.env.AWS_ACCESS_KEY_ID = "test-access-key-id";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key-not-real";
