/**** collection-meta-table.js | SQLContextCollection ****/
//==============================================================
import { ExtendError }              from 'logic-entity';
import { Util }                     from 'logic-entity';
import { Type }                     from 'logic-entity';
import { MetaObject }               from 'logic-entity';
import { PropertyCollection }       from 'logic-core';
import { SQLContext }              from './sql-context.js';


class SQLContextCollection extends PropertyCollection {
    /**
     * 메타 테이블 컬렉션
     * @param {object} p_owner 소유자
     */
    constructor(p_owner) {
        super(p_owner);
        
        this._elemTypes = SQLContext;
        this.$KEYWORD = [];
    }

    static _NS = 'Meta.Entity';
    static _PARAMS = ['_owner'];

    /**
     * 테이블 컬렉션에 엔티티 추가
     * - 추가하는 `p_context`가 재귀적으로 `this._owner`를 포함하면 경고 출력
     * @param {string|SQLContext} p_key 키 또는 컨텍스트 인스턴스
     * @param {SQLContext} [p_context] 추가할 SQLContext
     * @returns {SQLContext} 등록한 아이템
     */
    add(p_key, p_context) {
        // TODO: message code 추가
        if (!p_key) throw new ExtendError(/EL05425/, null, [this.constructor.name]);
        if (!(typeof p_key === 'string' && p_key.length > 0) && !(p_context instanceof SQLContext)) {
            throw new ExtendError(/EL05426/, null, [this.constructor.name, typeof p_key, typeof p_context]);
        }
        if (p_context && !(p_context instanceof SQLContext)) {
            throw new ExtendError(/EL05427/, null, [this.constructor.name, typeof p_context]);
        }

        // 순환 검출: 추가하는 p_context 내에 현재 소유자(this._owner)가 포함되는지 검사
        const ctx = (p_context instanceof SQLContext) ? p_context : null;
        
        // ctx.connect = this._owner.connect; // 소유자의 connect 설정
        // ctx.db = this._owner.db;           // 소유자의 db 설정

        if (ctx.getLoadContext().includes(this._owner)) {
            console.warn('SQLContext 가 현재 _onwer 가 포함되어 있어, 순환구조를 갖습니다. 추가 모듈을 FK 롤 사용하는데 제한이 있습니다.');
        }
        
        // if (ctx && this.hasCircularWithOwner(ctx)) {
        //     // 요구 메시지: 경고만 출력하고 추가는 진행
        //     console.warn('SQLContext 가 현재 _onwer 가 포함되어 있어, 순환구조를 갖습니다. 추가 모듈을 FK 롤 사용하는데 제한이 있습니다.');
        // }
        return super.add(p_key, p_context);
    }

    /**
     * p_context가 재귀적으로 현재 소유자(this._owner)를 포함하는지 여부
     * @param {SQLContext} p_context 검사 대상 컨텍스트
     * @returns {boolean} 포함 시 true
     */
    hasCircularWithOwner(p_context) {
        if (!(p_context instanceof SQLContext)) return false;
        return this._includesOwnerRecursive(p_context, new Set());
    }

    /**
     * 현재 컬렉션(= this._owner의 하위 contexts 트리) 내에 순환구조가 존재하는지 조회
     * @returns {boolean} 순환 존재 여부
     */
    hasCircularDependency() {
        return this.findCircularPaths(1).length > 0;
    }

    /**
     * 현재 컬렉션 트리에서 발견되는 순환 경로들을 조회합니다.
     * - 경로는 [A, B, C, A] 형태로 시작/끝이 동일한 노드로 닫힌 배열입니다.
     * @param {number} [limit=0] 최대 수집 개수 (0은 무제한)
     * @returns {Array<Array<SQLContext>>} 순환 경로 목록
     */
    findCircularPaths(limit = 0) {
        const cycles = [];
        const visited = new Set();    // 완전 방문(black)
        const visiting = new Set();   // 방문 중(gray)
        const stack = [];             // 경로 스택

        const pushCycle = (node) => {
            // stack 안에서 node가 처음 등장한 위치부터 현재까지 + node로 사이클 경로 구성
            const idx = stack.indexOf(node);
            if (idx >= 0) {
                const path = stack.slice(idx).concat(node);
                cycles.push(path);
            }
        };

        const dfs = (node) => {
            if (!node || (limit > 0 && cycles.length >= limit)) return;
            if (visited.has(node)) return;
            if (visiting.has(node)) {
                pushCycle(node);
                return;
            }
            visiting.add(node);
            stack.push(node);
            const childLen = node.contexts && typeof node.contexts.length === 'number' ? node.contexts.length : 0;
            for (let i = 0; i < childLen; i++) {
                const child = node.contexts[i];
                if (limit > 0 && cycles.length >= limit) break;
                if (child) dfs(child);
            }
            stack.pop();
            visiting.delete(node);
            visited.add(node);
        };

        // 소유자 기준으로 전체 트리를 순회
        const owner = this._owner;
        if (owner) dfs(owner);
        // 혹시 소유자가 비어있거나 일부 분기 누락 대비: 직접 소유 컬렉션의 1차 자식도 시작점으로 순회
        for (let i = 0; (limit === 0 || cycles.length < limit) && i < this.length; i++) {
            dfs(this[i]);
        }
        return cycles;
    }

    /**
     * 내부 유틸: p_context 아래(재귀)에서 this._owner 포함 여부 확인
     * @private
     * @param {SQLContext} p_context 시작 노드
     * @param {Set<SQLContext>} visited 방문 집합
     * @returns {boolean}
     */
    _includesOwnerRecursive(p_context, visited) {
        if (!p_context) return false;
        if (p_context === this._owner) return true;
        if (visited.has(p_context)) return false;
        visited.add(p_context);
        const len = p_context.contexts && typeof p_context.contexts.length === 'number' ? p_context.contexts.length : 0;
        for (let i = 0; i < len; i++) {
            const child = p_context.contexts[i];
            if (this._includesOwnerRecursive(child, visited)) return true;
        }
        return false;
    }

}

// Object.defineProperty(SQLContextCollection.prototype, 'add', {
//     enumerable: false
// });
// Object.defineProperty(SQLContextCollection.prototype, 'existTableName', {
//     enumerable: false
// });

export default SQLContextCollection;
export { SQLContextCollection };
