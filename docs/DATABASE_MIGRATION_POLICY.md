# Database Migration and Data Preservation Policy

**Goal:** Preserve user and business data through all schema changes in dev, test and prod.

## Rules

1. Never use `EnsureDeleted`, `DropDatabase`, destructive database resets, or database recreation against persistent environments.
2. Do not merge or execute migrations containing `DropTable`, `DropColumn`, destructive `AlterColumn`, raw `DELETE`/`TRUNCATE`, or unreviewed data transformations without a separate explicit approval and a verified backup/recovery plan.
3. Prefer additive, backward-compatible migrations: create tables, add nullable columns, backfill safely, switch readers/writers, and remove obsolete structures only in a separately approved future change.
4. Generate migration files and **review both `Up()` and `Down()`** and generated SQL before application.
5. Back up the target database and verify a restore procedure before higher-risk changes. Test against representative data before production.
6. Apply migrations deliberately, with environment-specific credentials and a clear rollback/recovery procedure. Never infer that rollback of a schema migration automatically restores deleted data.
7. All changes must preserve existing records unless the owner explicitly approves a documented data-retention/deletion operation.
8. Add regression tests for important data-preservation scenarios.

## Current implementation caveat

`backend/Program.cs` calls `dbContext.Database.Migrate()` at startup **when `Database:AutoMigrate` is true**. This behavior is not changed by this documentation-only update. For a strict approval gate, verify this setting is disabled in deployed environments and make any required code/configuration changes in a separate reviewed PR.

EF Core has no global switch that guarantees arbitrary migrations can never delete data. These controls rely on review, permissions, backups, tests, and deployment safeguards.
