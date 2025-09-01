// ES6
import { Kysely, sql } from 'kysely'

class PrefixSuffixPlugin {
  /**
   * @param {{
   *  tablePrefix?: string,
   *  tableSuffix?: string,
   *  columnPrefix?: string,
   *  columnSuffix?: string,
   *  excludeTables?: Array<string|RegExp>,
   *  excludeColumns?: Array<string|RegExp>,
   *  caseSensitive?: boolean,
   * }} opts
   */
  constructor (opts = {}) {
    this.tablePrefix  = opts.tablePrefix  || ''
    this.tableSuffix  = opts.tableSuffix  || ''
    this.columnPrefix = opts.columnPrefix || ''
    this.columnSuffix = opts.columnSuffix || ''
    this.caseSensitive = opts.caseSensitive ?? true
    // 테이블/컬럼 매핑 추가
    this.tableMap = opts.tableMap || {} // { 원본명: 변경명 }
    this.columnMap = opts.columnMap || {} // { 테이블명: { 원본컬럼: 변경컬럼 } } 또는 { 원본컬럼: 변경컬럼 }
    this.allowAffixOnMapped = opts.allowAffixOnMapped ?? false
    // 기본적으로 sqlite 시스템 테이블은 제외
    this.excludeTables = opts.excludeTables ?? []
    this.excludeColumns = opts.excludeColumns ?? []
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
    // 테이블명/컬럼명 매핑 및 prefix/suffix 제외 처리
    const transformed = deepCloneAndTransform(node, (node) => {
      // 테이블 식별자
      if (node && node.kind === 'TableNode' && node.table && node.table.kind === 'SchemableIdentifierNode' && node.table.identifier && node.table.identifier.kind === 'IdentifierNode') {
        const tname = node.table.identifier.name
        // 매핑 우선 적용
        if (this.tableMap[tname]) {
          return {
            ...node,
            table: {
              ...node.table,
              identifier: {
                ...node.table.identifier,
                name: this.tableMap[tname]
              }
            }
          }
        }
        // 제외 대상이면 prefix/suffix 미적용
        if (this.#match(tname, this.excludeTables)) return node
        return {
          ...node,
          table: {
            ...node.table,
            identifier: {
              ...node.table.identifier,
              name: this.tablePrefix + tname + this.tableSuffix
            }
          }
        }
      }

      // 컬럼 식별자
      if (node && node.kind === 'ColumnNode' && node.column && node.column.kind === 'IdentifierNode') {
        const cname = node.column.name
        const tnameCurrent = (node.table && node.table.kind === 'IdentifierNode') ? node.table.name : undefined
        // 원본 테이블명 추정 (tableMap 역탐색)
        let tnameOriginal = tnameCurrent
        if (tnameCurrent) {
          for (const [orig, mapped] of Object.entries(this.tableMap)) {
            if (mapped === tnameCurrent) { tnameOriginal = orig; break }
          }
        }
        // 매핑 우선 적용: 테이블별 -> 전역(flat)
        let mappedCol
        if (tnameOriginal && this.columnMap[tnameOriginal] && this.columnMap[tnameOriginal][cname]) {
          mappedCol = this.columnMap[tnameOriginal][cname]
        } else if (typeof this.columnMap[cname] === 'string') {
          mappedCol = this.columnMap[cname]
        } else if (!tnameOriginal) {
          // 테이블 정보가 없으면 모든 테이블 맵에서 검색(단일 매칭 시에만 적용)
          const candidates = []
          for (const [tbl, map] of Object.entries(this.columnMap)) {
            if (map && typeof map === 'object' && map[cname]) candidates.push(map[cname])
          }
          if (candidates.length === 1) mappedCol = candidates[0]
        }

        if (mappedCol) {
          const name = this.allowAffixOnMapped ? (this.columnPrefix + mappedCol + this.columnSuffix) : mappedCol
          return { ...node, column: { ...node.column, name } }
        }

        if (this.#match(cname, this.excludeColumns) || (tnameCurrent && this.#match(tnameCurrent, this.excludeTables))) return node
        return { ...node, column: { ...node.column, name: this.columnPrefix + cname + this.columnSuffix } }
      }

      // 스키마: 컬럼 정의 노드 (createTable 내부)
      if (node && node.kind === 'ColumnDefinitionNode' && node.column && node.column.kind === 'IdentifierNode') {
        // 테이블명 추출 불가시 prefix/suffix만 적용
        const cname = node.column.name;
        // 컬럼 매핑 우선 적용 (테이블명 필요시 확장)
        if (this.#match(cname, this.excludeColumns)) return node
        return {
          ...node,
          column: {
            ...node.column,
            name: this.columnPrefix + cname + this.columnSuffix
          }
        }
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
