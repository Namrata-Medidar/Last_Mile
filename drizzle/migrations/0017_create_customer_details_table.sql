-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create customer details table
CREATE TABLE IF NOT EXISTS customer_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company TEXT NOT NULL,

    store_code TEXT UNIQUE NOT NULL,
    city TEXT,
    store_name TEXT,
    poc TEXT,
    poc_no TEXT,
    address TEXT,
    priority TEXT,
    site_readiness TEXT,
    status TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);