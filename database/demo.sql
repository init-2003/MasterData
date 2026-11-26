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

CREATE TABLE IF NOT EXISTS Web_Promo_WelCome (
    Promo_Id INTEGER PRIMARY KEY,
    Promo_Title TEXT,
    Image_Url TEXT NOT NULL,
    Link_Url TEXT,
    Sort_Order INTEGER DEFAULT 1,
    Is_Active INTEGER DEFAULT 1,
    Created_At TEXT DEFAULT CURRENT_TIMESTAMP,
    Updated_At TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Web_Promo_Sale (
    Promo_Id INTEGER PRIMARY KEY,
    Promo_Title TEXT,
    Image_Url TEXT NOT NULL,
    Link_Url TEXT,
    Sort_Order INTEGER DEFAULT 1,
    Is_Active INTEGER DEFAULT 1,
    Created_At TEXT DEFAULT CURRENT_TIMESTAMP,
    Updated_At TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Web_Carousel (
    Carousel_Id INTEGER PRIMARY KEY,
    Slide_Title TEXT,
    Image_Url TEXT NOT NULL,
    Sort_Order INTEGER DEFAULT 1,
    Is_Active INTEGER DEFAULT 1,
    Created_At TEXT DEFAULT CURRENT_TIMESTAMP,
    Updated_At TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Web_Promotion_Level (
    Auto_ID INTEGER PRIMARY KEY,
    Customer_Lavel TEXT DEFAULT '',
    Level_Name TEXT,
    Image_Url TEXT,
    Status TEXT DEFAULT 'Y',
    Sort_Order INTEGER,
    Remark TEXT,
    Create_Date TEXT DEFAULT CURRENT_TIMESTAMP,
    Link_Url TEXT DEFAULT '',
    Is_Active INTEGER NOT NULL DEFAULT 1,
    Updated_At TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Customer (
    Customer_Id TEXT PRIMARY KEY,
    Customer_Name TEXT,
    Customer_Type TEXT,
    Customer_Lavel TEXT
);
