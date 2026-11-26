USE [DBITManagement];
GO

-- Cus_User identifies a customer account, so non-empty values must be unique.
-- Empty strings and NULL are excluded because new rows default Cus_User to ''.
-- A filtered index needs these SET options for any INSERT/UPDATE on dbo.Customer
-- (ANSI_WARNINGS ON also turns ARITHABORT on at compatibility level 90 or later).
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Customer') AND name = N'UX_Customer_Cus_User')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Customer_Cus_User
        ON dbo.Customer (Cus_User)
        WHERE Cus_User IS NOT NULL AND Cus_User <> '';
GO

-- Rollback: DROP INDEX UX_Customer_Cus_User ON dbo.Customer;
