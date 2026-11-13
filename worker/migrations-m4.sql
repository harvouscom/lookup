-- Claimed listings: 1 when the church has verified its listed inbox on Here's My Church.
ALTER TABLE church ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0;
