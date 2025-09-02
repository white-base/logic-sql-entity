// ES6
import { Kysely, sql } from 'kysely'

class PrefixSuffixPlugin {
  /**
   * @param {{
   *  tablePrefix?: string,
   *  tableSuffix?: string,
   *  excludeTables?: Array<string|RegExp>,
   *  caseSensitive?: boolean,
   * }} opts
   */
  constructor (opts = {}) {
    this.tablePrefix  = opts.tablePrefix  || ''
    this.tableSuffix  = opts.tableSuffix  || ''
    this.caseSensitive = opts.caseSensitive ?? true
    // 테이블/컬럼 매핑 추가
    this.tableMap = opts.tableMap || {} // { 원본명: 변경명 }
    // 기본적으로 sqlite 시스템 테이블은 제외
    this.excludeTables = opts.excludeTables ?? []
  }

  #match (name, patterns) {
    return patterns.some(p =>
      typeof p === 'string'
        ? (this.caseSensitive ? name === p : name.toLowerCase() === p.toLowerCase())
        : p instanceof RegExp
          ? p.test(name)
          : false
    )
  }

  transformQuery ({ node /* RootOperationNode */, queryId }) {
    // 테이블명 매핑(tableMap)이 있으면 prefix/suffix는 무시한다.
    // DDL/참조 노드까지 포괄 처리.
    const transformed = deepCloneAndTransform(node, (node) => {
      if (!node || typeof node !== 'object') return node

      // 1) 일반 쿼리 내 테이블 노드
      if (node.kind === 'TableNode'
        && node.table?.kind === 'SchemableIdentifierNode'
        && node.table.identifier?.kind === 'IdentifierNode') {
        const tname = node.table.identifier.name
        const mapped = this.tableMap[tname]
        if (mapped) {
          // 매핑되면 접두/접미사 미적용
          return {
            ...node,
            table: { ...node.table, identifier: { ...node.table.identifier, name: mapped } }
          }
        }
        if (this.#match(tname, this.excludeTables)) return node
        return {
          ...node,
          table: {
            ...node.table,
            identifier: { ...node.table.identifier, name: this.tablePrefix + tname + this.tableSuffix }
          }
        }
      }

      // 2) CREATE/DROP TABLE 등 DDL 노드의 테이블 식별자 처리
      if ((node.kind === 'CreateTableNode' || node.kind === 'DropTableNode') && node.table) {
        const tbl = node.table
        // 2-1) IdentifierNode 직접 보유하는 경우
        if (tbl.kind === 'IdentifierNode') {
          const tname = tbl.name
          const mapped = this.tableMap[tname]
          if (mapped) return { ...node, table: { ...tbl, name: mapped } }
          if (this.#match(tname, this.excludeTables)) return node
          return { ...node, table: { ...tbl, name: this.tablePrefix + tname + this.tableSuffix } }
        }
        // 2-2) TableNode 래핑 형태인 경우
        if (tbl.kind === 'TableNode' && tbl.table?.kind === 'IdentifierNode') {
          const tname = tbl.table.name
          const mapped = this.tableMap[tname]
          if (mapped) return { ...node, table: { ...tbl, table: { ...tbl.table, name: mapped } } }
          if (this.#match(tname, this.excludeTables)) return node
          return { ...node, table: { ...tbl, table: { ...tbl.table, name: this.tablePrefix + tname + this.tableSuffix } } }
        }
        return node
      }

      // 3) FROM/JOIN 등의 테이블 참조 노드
      if (node.kind === 'TableReferenceNode' && node.table?.kind === 'IdentifierNode') {
        const tname = node.table.name
        const mapped = this.tableMap[tname]
        if (mapped) return { ...node, table: { ...node.table, name: mapped } }
        if (this.#match(tname, this.excludeTables)) return node
        return { ...node, table: { ...node.table, name: this.tablePrefix + tname + this.tableSuffix } }
      }

      return node
    })
    return transformed
  }

  transformResult (args) {
    // 결과는 건드리지 않음
    return args.result
  }
}

/**
 * OperationNode(중첩 객체/배열) 전체를 깊은 복제하면서
 * 각 노드에 사용자 정의 변환 함수를 적용합니다.
 * - nodeTransformer는 특정 노드일 때만 변경하고, 아니면 원본을 그대로 반환해야 합니다.
 */
function deepCloneAndTransform (node, nodeTransformer) {
  const n1 = nodeTransformer(node) // 일단 한 번 변환 시도
  if (n1 === null || typeof n1 !== 'object') return n1

  if (Array.isArray(n1)) {
    return n1.map((child) => deepCloneAndTransform(child, nodeTransformer))
  }

  // 일반 객체
  const out = {}
  for (const k of Object.keys(n1)) {
    out[k] = deepCloneAndTransform(n1[k], nodeTransformer)
  }
  return out
}

export default PrefixSuffixPlugin
export { PrefixSuffixPlugin }
