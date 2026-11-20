CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    barcode TEXT,
    category TEXT,
    unit TEXT,
    price TEXT,
    note TEXT,
    short_note TEXT,
    image1 TEXT,
    image2 TEXT
);

CREATE TABLE IF NOT EXISTS types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
