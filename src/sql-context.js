/**** sql-context.js | SQLContext ****/
//==============================================================
import { MetaElement } from 'logic-entity';
import { PropertyCollection } from 'logic-entity';
import { SQLContextCollection } from './collection-sql-context.js';
import { MetaTableCollection } from 'logic-entity';

import { Kysely }                       from 'kysely';
import { sql } from 'kysely';

import { detectAndStoreDbInfo } from './util/db-info.js';
import { resolveDbFeatures } from './util/db-features.js';

// REVIEW: 개발후 제거
import { viewTable } from '../temp/view-table.js';

class SQLContext extends MetaElement {
    constructor(p_name) {
        super(p_name);

        this._tables = new MetaTableCollection(this);
        this.tbl = this.tables; // tbl (alias)
        this._queries = new PropertyCollection(this);
        this.qry = this.queries; // qry (alias)
        this._contexts = new SQLContextCollection(this);
        this.ctx = this.contexts; // ctx (alias)
        this._commands = new PropertyCollection(this);
        this.cmd = this.commands; // cmd (alias)
        this._procedures = new PropertyCollection(this);
        this.proc = this.procedures; // proc (alias)
        
        this._connect     = null;
        this._db          = null;
        this._profile     = {};
    }

    get tables() {
        return this._tables;
    }

    get queries() {
        return this._queries;
    }

    get contexts() {
        return this._contexts;
    }

    get commands() {
        return this._commands;
    }

    get procedures() {
        return this._procedures;
    }

    get connect() {
        return this._connect;
    }
    set connect(p_connect) {
        this._connect = p_connect;
    }

    get db () {
        if (!this._db) {
            this._db = new Kysely(this._connect);
            // DB 종류
            // resolveDbFeatures(this._db, this._connect);

            // const info = detectAndStoreDbInfo({ db: this._db, connect: this._connect }, { force: false });
            // this.vendor = info.kind;
            // this.features = resolveDbFeatures(info.kind, info.version);

            // resolveDbFeatures()
        }
        return this._db;
    }

    get profile() {
        return this._profile;
    }
    set profile(p) {
        this._profile = p;
    }

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = await resolveDbFeatures(info.kind, info.version);
    }

    async validateDefinition(dbOrConn = null) {

        let db = null;

        if (typeof dbOrConn === 'object' && dbOrConn?.dialect) {
            db = new Kysely(dbOrConn);
        } else {
            db = dbOrConn || this.db;
        }

        // TODO: 정의 검증 로직 추가
        if (this.profile.vendor === 'sqlite') {
            // SQLite에 대한 검증 로직 추가
            // await sql`ATTACH DATABASE 'file:sub.db' AS sub`.execute(db);
            
            // await sql`ATTACH DATABASE ':memory:' AS ${testDb}`.execute(this.db);


            // const sdb = this.db.withSchema(testDb);

            await db.transaction().execute(async (trx) => {
                // await trx.schema.createTable('users')
                //     .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
                //     .execute();

                await this.createSchema(trx);

                // TODO: dropSchema(trx); 추가 필요

                // 처리완료
                // await viewTable(sdb, '생성 검사 후 > 테이블 목록');
                await viewTable(trx, '검사 > 생성 후 > 테이블 목록');

                await this.dropSchema(trx);
                await viewTable(trx, '검사 > 삭제 후 > 테이블 목록');
                
                throw { rollback: true };
                // throw new Error('Schema creation should have failed due to missing tables.');
            }).catch(msg => {
                // 여기서 에러 처리
                // console.warn('테이블 생성 에러:', error);
                if (msg && msg.rollback) {
                    console.log('테이블 생성 성공: ', msg);
                } else {
                    console.error('테이블 생성 에러:', msg);
                }
            });
            await viewTable(db, '검사 > 롤백 후 > 테이블 목록');

        } else if (this.profile.vendor === 'mysql') {
            // MySQL에 대한 검증 로직 추가 TODO:
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();

        } else if (this.profile.vendor === 'postgres') {
            // PostgreSQL에 대한 검증 로직 추가 TODO:
            await sql`CREATE SCHEMA IF NOT EXISTS "app"`.execute(this.db);
            const pdb = this.db.withSchema('app');
            await pdb.schema.createTable('users')
                .addColumn('id', 'serial', col => col.primaryKey())
                .execute();            

        } else if (this.profile.vendor === 'mssql') {
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장 TODO:
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();
        } else if (this.profile.vendor === 'maria') {
            // MariaDB에 대한 검증 로직 추가 TODO:
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();
        }
    }

    getLoadContext (loaded, visiting, out) {
        loaded   = loaded   || [];  // 전역/세션 차원의 "이미 로딩됨" 집합
        visiting = visiting || [];  // 현재 DFS 경로(사이클 감지)
        out      = out      || [];  // 이번 호출에서 실제 로딩된 순서

        // 1) 이미 전역적으로 로딩된 경우: 즉시 종료
        if (loaded.indexOf(this) >= 0) return out;

        // 2) 현재 경로에 다시 나타났다면 사이클 → 우회(무한 루프 방지)
        if (visiting.indexOf(this) >= 0) return out;

        // 3) 현재 경로 진입
        visiting.push(this);

        // 4) 자식(의존) 먼저 로딩
        for (var i = 0; i < this.contexts.length; i++) {
            var dep = this.contexts[i];
            if (dep) dep.getLoadContext(loaded, visiting, out);
        }

        // 5) 자신 로딩 (아직 전역 loaded에 없으면)
        if (loaded.indexOf(this) < 0) {
            loaded.push(this);
            out.push(this);
        }

        // 6) 현재 경로 이탈
        visiting.pop();

        return out;
    }

    /**
     * Calculate unload list for a target context under this entry.
     *
     * - Call from the entry (root) SQLContext: `entry.getUnloadContext(idxOrCtx)`
     * - Returns contexts to unload in dependency-first order (child before parent).
     * - If the target (or any of its dependencies) is still required by another
     *   active sibling, they are excluded. If the target itself is still required
     *   by another sibling (i.e., another sibling depends on it), returns [].
     *
     * Examples (matching the diagram/description):
     *  - Unload C alone → [B, C] (A remains if still used elsewhere)
     *  - Unload E alone while F depends on E → []
     *  - Unload F alone when E also uses shared deps → [F]
     *  - Unload G alone when E uses D → [G]
     *
     * @param {number|object} targetOrIdx Index in this.contexts or the target SQLContext instance
     * @returns {Array<SQLContext>} Ordered list to unload (dependencies first)
     */
    getUnloadContext (targetOrIdx) {
        // Resolve target
        let target = null;
        if (typeof targetOrIdx === 'number') target = this.contexts[targetOrIdx];
        else if (targetOrIdx) target = targetOrIdx;
        else return [];
        if (!target) return [];
        // Build forward adjacency (uses: parent -> dependencies) from this root
        const adj = new Map(); // Map<SQLContext, SQLContext[]>
        const all = new Set(); // Set<SQLContext>
        const dfsBuild = (node) => {
            if (!node || all.has(node)) return;
            all.add(node);
            const deps = [];
            if (node.contexts && typeof node.contexts.length === 'number') {
                for (let i = 0; i < node.contexts.length; i++) {
                    const child = node.contexts[i];
                    if (child) deps.push(child);
                }
            }
            adj.set(node, deps);
            for (const d of deps) dfsBuild(d);
        };
        dfsBuild(this);
        // Helper: forward reachability (including start)
        const reachFrom = (starts) => {
            const seen = new Set();
            const stack = Array.isArray(starts) ? starts.slice() : [starts];
            while (stack.length) {
                const n = stack.pop();
                if (!n || seen.has(n)) continue;
                seen.add(n);
                const deps = adj.get(n) || [];
                for (let i = deps.length - 1; i >= 0; i--) stack.push(deps[i]);
            }
            return seen;
        };
        // Active roots: all siblings except the target (when called on entry)
        const directRoots = [];
        for (let i = 0; i < this.contexts.length; i++) directRoots.push(this.contexts[i]);
        const activeRoots = directRoots.filter((r) => r && r !== target);
        // Nodes still needed after removing the target branch
        const stillNeeded = reachFrom(activeRoots);
        // If target itself is still needed by another active root, cannot unload
        if (stillNeeded.has(target)) return [];
        // Candidate nodes that would become unused: all dependencies (closure) of target
        const depsOfTarget = reachFrom(target);
        // Unload set = (depsOfTarget U {target}) minus nodes still needed by others
        const unloadSet = new Set();
        for (const n of depsOfTarget) {
            if (!stillNeeded.has(n)) unloadSet.add(n);
        }
        // Ensure target included when not needed by others
        unloadSet.add(target);
        // Sort: dependency-first (child before parent) within the unloadSet
        const ordered = [];
        const visiting = new Set();
        const visited = new Set();
        const dfsOrder = (node) => {
            if (!node || visited.has(node) || !unloadSet.has(node)) return;
            if (visiting.has(node)) return; // cycle guard
            visiting.add(node);
            const deps = adj.get(node) || [];
            for (let i = 0; i < deps.length; i++) {
                const d = deps[i];
                if (unloadSet.has(d)) dfsOrder(d);
            }
            visiting.delete(node);
            visited.add(node);
            ordered.push(node);
        };
        // Start from target to keep deterministic order consistent with dependency walk
        dfsOrder(target);
        // There could be disconnected nodes in unloadSet (rare); include them deterministically
        if (ordered.length !== unloadSet.size) {
            for (const n of unloadSet) dfsOrder(n);
        }
        return ordered;
    }

    async createSchema(dbOrConn = null) {
        /**
         * 우선순위
         * 1. 하위 스키마 실행
         * 2.1 테이블 생성
         * 2.2 인덱스 생성
         * 2.3 제약 조건 생성
         */
        const db = dbOrConn || this.db;;

        // if (typeof dbOrConn === 'object' && dbOrConn.dialect) {
        //     db = new Kysely(dbOrConn);
        // } else {
        //     db = dbOrConn || this.db;
        // }

        // TODO: DB 연결 검사

        // If not in a transaction, start one
        if (db && db.constructor && db.constructor.name === 'Kysely') {
            await db.transaction().execute(async (trx) => {
                await this._createSchemaRecursive(trx);
            });
        } else {
            // Already in a transaction (trx)
            await this._createSchemaRecursive(db);
        }
        // await this._createSchemaRecursive(db);

    }

    async _createSchemaRecursive(trx) {

        const createList = this.getLoadContext();

        for (let i = 0; i < createList.length; i++) {
            const ctx = createList[i];
            ctx.connect = ctx.connect || this.connect;
            ctx.profile = ctx.profile || this.profile;

            for (let j = 0; j < ctx.tables.length; j++) {
                const tbl = ctx.tables[j];
                tbl.connect = tbl.connect || this.connect;
                tbl.profile = tbl.profile || this.profile;
                await tbl.create(trx);
            }
        }

        // schemaList.forEach((ctx) => {
        //     ctx.connect = this.connect;
        //     ctx.profile = this.profile;
        //     const context = ctx;
        //     ctx.tables.forEach((tbl) => {
        //         tbl.connect = this.connect;
        //         tbl.profile = this.profile;
        //         await tbl.create(trx);
        //         // console.log(tbl.tableName);
        //     });
        // });

        // for (let idx = 0; idx < this.contexts.length; idx++) {
        //     const ctx = this.contexts[idx];
        //     // if (!ctx) continue;
        //     if (typeof ctx.createSchema === 'function') {
        //         ctx.connect = this.connect;
        //         ctx.profile = this.profile;
        //         await ctx.createSchema(trx);
        //     }
        // }

        // // for (const [index, table] of this.tables.entries()) {
        // for (let idx = 0; idx < this.tables.length; idx++) {
        //     const table = this.tables[idx];
        //     // if (!table) continue;
        //     if (typeof table.create === 'function') {
        //         table.connect = this.connect;
        //         table.profile = this.profile;
        //         await table.create(trx);
        //     }
        // }
    }

    async dropSchema(dbOrConn = null) {
        // Drops tables for this context and nested contexts.
        // Uses existing transaction if provided; otherwise starts one.
        const db = dbOrConn || this.db;

        if (db && db.constructor && db.constructor.name === 'Kysely') {
            await db.transaction().execute(async (trx) => {
                await this._dropSchemaRecursive(trx);
            });
        } else {
            await this._dropSchemaRecursive(db);
        }
    }

    async _dropSchemaRecursive(trx) {

        // 3. 로딩의 역순의로 해제
        const createList = this.getLoadContext();
        const dropList = createList.reverse();
        for (let i = 0; i < dropList.length; i++) {
            const ctx = dropList[i];
            ctx.connect = ctx.connect || this.connect;
            ctx.profile = ctx.profile || this.profile;

            for (let k =  ctx.tables.length - 1; k >= 0; k--) {
                const tbl = ctx.tables[k];
                tbl.connect = tbl.connect || this.connect;
                tbl.profile = tbl.profile || this.profile;
                await tbl.drop(trx);
            }
        }
        
        // 2. Drop nested contexts first (child-first to avoid FK issues)
        // for (let i = this.contexts.length - 1; i >= 0; i--) {
        //     const ctx = this.contexts[i];
        //     ctx.connect = ctx.connect || this.connect;
        //     ctx.profile = ctx.profile || this.profile;

        //     const depend = this.getUnloadContext(i);

        //     for (let j = 0; j < depend.length; j++) {
        //         const d_ctx = depend[j];
        //         d_ctx.connect = d_ctx.connect || this.connect;
        //         d_ctx.profile = d_ctx.profile || this.profile;

        //         for (let k =  d_ctx.tables.length - 1; k >= 0; k--) {
        //             const tbl = d_ctx.tables[k];
        //             tbl.connect = tbl.connect || this.connect;
        //             tbl.profile = tbl.profile || this.profile;
        //             await tbl.drop(trx);
        //         }
        //     }

        //     for (let k =  this.tables.length - 1; k >= 0; k--) {
        //         const tbl = this.tables[k];
        //         await tbl.drop(trx);
        //     }
        // }


        // 1. 고전방식
        // // 1) Drop this context's tables
        // for (let idx = this.tables.length - 1; idx >= 0; idx--) {
        //     // const table = this.tables[idx];
        //     // const tableName = table.tableName || table._name || String(table);
        //     // await trx.schema.dropTable(tableName).ifExists().execute();

        //     await this.tables[idx].drop(trx);
        // }
        
        // // 2) Drop nested contexts first (child-first to avoid FK issues)
        // for (let idx = this.contexts.length - 1; idx >= 0; idx--) {
        //     const ctx = this.contexts[idx];
        //     ctx.connect = this.connect;
        //     ctx.profile = this.profile;
        //     await ctx.dropSchema(trx);
        // }
    }

    ensureSchema() {
        // Ensure that the database schema is created
    }

    syncSchema() {
        // Sync the database schema with the current context
    }

    diffSchema() {
        // Compare the current schema with the database schema
    }

    // addTable(table) {
    //     this.tables.addValue(table.name, table);
    // }
}

export default SQLContext;
export { SQLContext };
