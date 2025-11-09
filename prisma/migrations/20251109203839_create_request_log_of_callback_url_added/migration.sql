-- CreateTable
CREATE TABLE "request_logs" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "query" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);
