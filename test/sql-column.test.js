import { jest } from '@jest/globals';

import { SQLColumn } from '../src/sql-column.js';

//==============================================================
// test
describe("[target: sql-column.js]", () => {
    describe("SQLColumn :: 클래스", () => {
        beforeEach(() => {
            jest.resetModules();
            // MetaRegistry.init();
        });
        describe("<테이블 등록후 속성 검사>", () => {
            it("- 테이블 등록후 속성 검사 ", () => {
                
            });
        });
        describe("getVendorType() : 벤더 타입", () => {
            it("- 확인: int", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'int' });
                
                expect(col.getVendorType('mysql')).toBe('integer');
                expect(col.getVendorType('mariadb')).toBe('integer');
                expect(col.getVendorType('postgres')).toBe('integer');
                expect(col.getVendorType('sqlite')).toBe('integer');
                expect(col.getVendorType('mssql')).toBe('integer');
            });
            it("- 확인: bigint", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'bigint' });
                
                expect(col.getVendorType('mysql')).toBe('bigint');
                expect(col.getVendorType('mariadb')).toBe('bigint');
                expect(col.getVendorType('postgres')).toBe('bigint');
                expect(col.getVendorType('sqlite')).toBe('integer');
                expect(col.getVendorType('mssql')).toBe('bigint');
            });
            it("- 확인: numeric(18,2)", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'numeric(18,2)' });
                
                expect(col.getVendorType('mysql')).toBe('numeric(18, 2)');
                expect(col.getVendorType('mariadb')).toBe('numeric(18, 2)');
                expect(col.getVendorType('postgres')).toBe('numeric(18, 2)');
                expect(col.getVendorType('sqlite')).toBe('numeric');
                expect(col.getVendorType('mssql')).toBe('numeric(18, 2)');
            });
            it("- 확인: double", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'double' });
                
                expect(col.getVendorType('mysql')).toBe('double precision');
                expect(col.getVendorType('mariadb')).toBe('double precision');
                expect(col.getVendorType('postgres')).toBe('double precision');
                expect(col.getVendorType('sqlite')).toBe('real');
                expect(col.getVendorType('mssql')).toBe('double precision');
            });
            it("- 확인: boolean", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'boolean' });
                
                expect(col.getVendorType('mysql')).toBe('smallint');
                expect(col.getVendorType('mariadb')).toBe('smallint');
                expect(col.getVendorType('postgres')).toBe('boolean');
                expect(col.getVendorType('sqlite')).toBe('integer');
                expect(col.getVendorType('mssql')).toBe('smallint');
            });
            it("- 확인: varchar", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'varchar(255)' });
                
                expect(col.getVendorType('mysql')).toBe('varchar(255)');
                expect(col.getVendorType('mariadb')).toBe('varchar(255)');
                expect(col.getVendorType('postgres')).toBe('varchar(255)');
                expect(col.getVendorType('sqlite')).toBe('text');
                expect(col.getVendorType('mssql')).toBe('varchar(255)');
            });
            it("- 확인: text", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'text' });
                
                expect(col.getVendorType('mysql')).toBe('text');
                expect(col.getVendorType('mariadb')).toBe('text');
                expect(col.getVendorType('postgres')).toBe('text');
                expect(col.getVendorType('sqlite')).toBe('text');
                expect(col.getVendorType('mssql')).toBe('varchar(8000)');
            });
            it("- 확인: char(10)", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'char(10)' });
                
                expect(col.getVendorType('mysql')).toBe('char(10)');
                expect(col.getVendorType('mariadb')).toBe('char(10)');
                expect(col.getVendorType('postgres')).toBe('char(10)');
                expect(col.getVendorType('sqlite')).toBe('text');
                expect(col.getVendorType('mssql')).toBe('char(10)');
            });
            it("- 확인: date", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'date' });
                
                expect(col.getVendorType('mysql')).toBe('date');
                expect(col.getVendorType('mariadb')).toBe('date');
                expect(col.getVendorType('postgres')).toBe('date');
                expect(col.getVendorType('sqlite')).toBe('numeric');
                expect(col.getVendorType('mssql')).toBe('date');
            });
            it("- 확인: time", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'time' });
                
                expect(col.getVendorType('mysql')).toBe('time');
                expect(col.getVendorType('mariadb')).toBe('time');
                expect(col.getVendorType('postgres')).toBe('time');
                expect(col.getVendorType('sqlite')).toBe('numeric');
                expect(col.getVendorType('mssql')).toBe('time');
            });
            it("- 확인: timestamp", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'timestamp' });

                expect(col.getVendorType('mysql')).toBe('datetime');
                expect(col.getVendorType('mariadb')).toBe('datetime');
                expect(col.getVendorType('postgres')).toBe('timestamp');
                expect(col.getVendorType('sqlite')).toBe('numeric');
                expect(col.getVendorType('mssql')).toBe('datetime');
            });
            it("- 확인: json", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'json' });
                
                expect(col.getVendorType('mysql')).toBe('json');
                expect(col.getVendorType('mariadb')).toBe('json');
                expect(col.getVendorType('postgres')).toBe('jsonb');
                expect(col.getVendorType('sqlite')).toBe('text');
                expect(col.getVendorType('mssql')).toBe('varchar(8000)');
            });
            it("- 확인: uuid", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'uuid' });
                
                expect(col.getVendorType('mysql')).toBe('char(36)');
                expect(col.getVendorType('mariadb')).toBe('char(36)');
                expect(col.getVendorType('postgres')).toBe('uuid');
                expect(col.getVendorType('sqlite')).toBe('text');
                expect(col.getVendorType('mssql')).toBe('varchar(36)');
            });
            it("- 확인: bytes", () => {
                const col = new SQLColumn('test_column', 'test_table', { dataType: 'bytes' });
                
                expect(col.getVendorType('mysql')).toBe('varbinary(255)');
                expect(col.getVendorType('mariadb')).toBe('varbinary(255)');
                expect(col.getVendorType('postgres')).toBe('bytea');
                expect(col.getVendorType('sqlite')).toBe('blob');
                expect(col.getVendorType('mssql')).toBe('varbinary(8000)');
            });
        });
    });
});