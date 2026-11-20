USE [DBITManagement];
GO

-- Replace this user with the dedicated SQL Server login created by your DBA.
IF DATABASE_PRINCIPAL_ID(N'sptc_master_web') IS NULL
    CREATE USER [sptc_master_web] FOR LOGIN [sptc_master_web];
GO

GRANT SELECT ON OBJECT::dbo.Trade TO [sptc_master_web];
GRANT SELECT ON OBJECT::dbo.[Type] (Type_Name) TO [sptc_master_web];
GRANT SELECT ON OBJECT::dbo.[Unit] (Unit_Name) TO [sptc_master_web];
GRANT SELECT ON OBJECT::dbo.System_Access (SUser, SPass) TO [sptc_master_web];
GO
