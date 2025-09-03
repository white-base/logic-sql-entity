PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "t_store" ("sto_id" integer primary key, "sto_name" text);
CREATE TABLE IF NOT EXISTS "pre_prt_master_suf" ("prt_id" integer primary key, "prt_name" text);
INSERT INTO pre_prt_master_suf VALUES(1,'Logic Store');
INSERT INTO pre_prt_master_suf VALUES(2,'Logic Store2');
COMMIT;
