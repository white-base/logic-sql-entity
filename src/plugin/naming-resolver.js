class NamingResolver {
  constructor({
    tableMap = {},                     // 논리 테이블명 -> 물리 테이블명
    columnMap = {},                    // (전역) 논리 컬럼명 -> 물리 컬럼명
    perTableColumnMap = {},            // 테이블별 컬럼 매핑 { tbl: { col: mappedCol } }
    tablePrefix = '', tableSuffix = '',
    columnPrefix = '', columnSuffix = '',
    allowAffixOnMapped = false,
    excludeTables = [],                // ['knex_migrations', /^sys_/]
    excludeColumns = [],               // ['created_at', /^__debug__/]
    caseSensitive = true,
  } = {}) {
    this.tableMap = tableMap
    this.columnMap = columnMap
    this.perTableColumnMap = perTableColumnMap
    this.tPre = tablePrefix
    this.tSuf = tableSuffix
    this.cPre = columnPrefix
    this.cSuf = columnSuffix
    this.allowAffixOnMapped = allowAffixOnMapped
    this.excludeTables = excludeTables
    this.excludeColumns = excludeColumns
    this.caseSensitive = caseSensitive
  }

  #match(name, patterns) {
    return patterns.some(p =>
      typeof p === 'string'
        ? (this.caseSensitive ? name === p : name.toLowerCase() === p.toLowerCase())
        : p instanceof RegExp
          ? p.test(name)
          : false
    )
  }

  #affix(name, pre, suf) {
    const hasPre = pre && name.startsWith(pre)
    const hasSuf = suf && name.endsWith(suf)
    return (hasPre ? '' : pre) + name + (hasSuf ? '' : suf)
  }

  resolveTable(logical) {
    if (this.#match(logical, this.excludeTables)) return logical

    // 1) 절대 매핑 우선
    const mapped = this.tableMap[logical]
    if (mapped) {
      return this.allowAffixOnMapped ? this.#affix(mapped, this.tPre, this.tSuf) : mapped
    }

    // 2) 매핑이 없으면 affix
    return this.#affix(logical, this.tPre, this.tSuf)
  }

  resolveColumn(tableLogicalOrResolved, logicalCol) {
    if (this.#match(logicalCol, this.excludeColumns)) return logicalCol

    // 1) 테이블별 컬럼 매핑 우선
    const tblMap = this.perTableColumnMap[tableLogicalOrResolved]
    if (tblMap && tblMap[logicalCol]) {
      const mapped = tblMap[logicalCol]
      return this.allowAffixOnMapped ? this.#affix(mapped, this.cPre, this.cSuf) : mapped
    }

    // 2) 전역 컬럼 매핑
    if (this.columnMap[logicalCol]) {
      const mapped = this.columnMap[logicalCol]
      return this.allowAffixOnMapped ? this.#affix(mapped, this.cPre, this.cSuf) : mapped
    }

    // 3) 매핑 없으면 affix
    return this.#affix(logicalCol, this.cPre, this.cSuf)
  }
}

function deepCloneAndTransform (node, f) {
  const n1 = f(node)
  if (n1 === null || typeof n1 !== 'object') return n1
  if (Array.isArray(n1)) return n1.map((ch) => deepCloneAndTransform(ch, f))
  const out = {}
  for (const k of Object.keys(n1)) out[k] = deepCloneAndTransform(n1[k], f)
  return out
}

class CombinedNamingPlugin {
  constructor(resolver) { this.r = resolver }

  transformQuery({ query }) {
    // 실제 AST 키는 Kysely 버전에 따라 약간 다를 수 있습니다.
    return deepCloneAndTransform(query, (node) => {
      if (!node || typeof node !== 'object') return node

      // 테이블 노드
      if (node.kind === 'TableNode' && node.table?.kind === 'IdentifierNode') {
        const logical = node.table.name
        const resolved = this.r.resolveTable(logical)
        if (resolved !== logical) {
          return { ...node, table: { ...node.table, name: resolved } }
        }
        return node
      }

      // FROM/JOIN 테이블 참조 (버전별 필요 시 활성화)
      if (node.kind === 'TableReferenceNode' && node.table?.kind === 'IdentifierNode') {
        const logical = node.table.name
        const resolved = this.r.resolveTable(logical)
        if (resolved !== logical) {
          return { ...node, table: { ...node.table, name: resolved } }
        }
        return node
      }

      // 컬럼 노드
      if (node.kind === 'ColumnNode' && node.column?.kind === 'IdentifierNode') {
        const tblName =
          node.table?.kind === 'IdentifierNode' ? node.table.name : undefined
        const logicalCol = node.column.name
        const resolvedCol = this.r.resolveColumn(tblName ?? '__unknown__', logicalCol)
        if (resolvedCol !== logicalCol) {
          return { ...node, column: { ...node.column, name: resolvedCol } }
        }
        return node
      }

      return node
    })
  }

  transformResult(args) { return args.result }
}

export { NamingResolver, CombinedNamingPlugin };

