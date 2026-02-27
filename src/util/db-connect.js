import { SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { MssqlDialect } from 'kysely';
import * as tedious from 'tedious';
import * as tarn from 'tarn';
import sqlite3 from 'sqlite3';
import mysql from 'mysql2';
import { Client as PgClient } from 'pg';
import mssql from 'mssql';

/**
 * DB 종류별 커넥션 또는 Kysely Dialect 객체를 반환하는 함수
 * @param {Object} options - DB 연결 옵션
 * @param {'sqlite'|'mysql'|'postgres'|'mssql'} [options.type='sqlite'] - DB 종류
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {string} [options.user]
 * @param {string} [options.password]
 * @param {string} [options.database]
 * @param {string} [options.file]
 * @param {string} [options.connectionString] - postgres 전용
 * @param {'dialect'|'connection'} [options.mode='connection'] - 반환 타입 선택
 * @returns {Object} DB 커넥션 또는 dialect 객체
 */
export function getDbConnection({
    type = 'sqlite',
    host,
    port,
    user,
    password,
    database,
    file,
    connectionString,
    mode = 'connection',
} = {}) {
    switch (type) {
    case 'sqlite': {
        const dbFile = file ?? './mydb-test.sqlite';
        if (mode === 'dialect') {
            return new SqliteDialect({ database: new Database(dbFile) });
        }
        return new sqlite3.verbose().Database(dbFile);
    }
    case 'postgres': {
        const connStr = connectionString
        ?? (typeof process !== 'undefined' && process.env && process.env.POSTGRES_URL)
        ?? (typeof process !== 'undefined' && process.env && process.env.KYSELY_POSTGRES_URL)
        ?? 'postgres://postgres:pg123@localhost:5434/mydb';
        if (mode === 'dialect') {
            const pool = new Pool({ connectionString: connStr, max: 1 });
            return { dialect: new PostgresDialect({ pool }) };
        }
        // connection 객체
        return new PgClient({
            host: host ?? 'localhost',
            port: port ?? 5432,
            user: user ?? 'postgres',
            password: password ?? 'pg123',
            database: database ?? 'mydb',
        });
    }
    case 'mssql': {
        if (mode === 'dialect') {
            const dialectConfig = {
                tarn: {
                    ...tarn,
                    options: {
                        min: 0,
                        max: 10,
                    },
                },
                tedious: {
                    ...tedious,
                    connectionFactory: () => new tedious.Connection({
                        authentication: {
                            options: {
                                password: password ?? 'Your_password123',
                                userName: user ?? 'sa',
                            },
                            type: 'default',
                        },
                        options: {
                            database: database ?? 'mydb',
                            port: port ?? 1433,
                            trustServerCertificate: true,
                        },
                        server: host ?? 'localhost',
                    }),
                },
            };
            return new MssqlDialect(dialectConfig);
        }
        return new mssql.ConnectionPool({
            server: host ?? '127.0.0.1',
            port: port ?? 1433,
            user: user ?? 'sa',
            password: password ?? 'Your_password123',
            database: database ?? 'mydb',
            options: {
                encrypt: true,
                trustServerCertificate: true,
            },
        });
    }
    case 'mysql': {
        if (mode === 'dialect') {
            const cfg = {
                host: host ?? '127.0.0.1',
                port: port ?? 3307,
                user: user ?? 'root',
                password: password ?? 'root123',
                database: database ?? 'mydb',
                waitForConnections: true,
                connectionLimit: 5,
            };
            const pool = mysql.createPool(cfg);
            const { MysqlDialect } = require('kysely');
            return new MysqlDialect({ pool });
        }
        return mysql.createConnection({
            host: host ?? '127.0.0.1',
            port: port ?? 3307,
            user: user ?? 'root',
            password: password ?? 'root123',
            database: database ?? 'mydb',
        });
    }
    default:
        throw new Error('지원하지 않는 DB 타입입니다.');
    }
}
// import mysql from 'mysql2';
// import { Client as PgClient } from 'pg';
// import mssql from 'mssql';

// const SQLITE_DEFAULT_FILE = './mydb-test.sqlite';
/**
 * DB 종류별 커넥션 객체를 반환하는 함수
 * @param {Object} options - DB 연결 옵션
 * @param {'sqlite'|'mysql'|'postgres'|'mssql'} [options.type='sqlite'] - DB 종류
 * @param {string} [options.host] - 호스트 (sqlite 제외)
 * @param {number} [options.port] - 포트 (sqlite 제외)
 * @param {string} [options.user] - 사용자명 (sqlite 제외)
 * @param {string} [options.password] - 비밀번호 (sqlite 제외)
 * @param {string} [options.database] - DB명
 * @param {string} [options.file] - sqlite 파일 경로 (sqlite 전용)
 * @returns {Object} DB 커넥션 객체
 */
// (통합된 getDbConnection 함수만 남기고, 이전 함수 및 관련 코드 완전 제거)
