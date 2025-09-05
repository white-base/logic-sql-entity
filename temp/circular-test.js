import { SQLContext } from '../src/sql-context.js'

// 순환 구조 경고/검출 테스트
// 시나리오: A <- C <- B <- A (A -> B, B -> C, C -> A)

const A = new SQLContext('A')
const B = new SQLContext('B')
const C = new SQLContext('C')

// 1) C 가 A 를 사용
C.contexts.add('A', A)

// 2) B 가 C 를 사용
B.contexts.add('C', C)

// 3) A 가 B 를 추가하려는 시점에, B 내부 재귀 구조에 A 가 포함되어 있음
//    => 경고 메세지가 출력되어야 함
A.contexts.add('B', B)

// 4) 컬렉션에 순환구조 조회
console.log('hasCircularDependency:', A.contexts.hasCircularDependency())
const cycles = A.contexts.findCircularPaths()
console.log('cycles:', cycles.map(path => path.map(n => n._name)))

// 참고: 경로는 [A, B, C, A] 형태로 닫힌 순환을 표현합니다.

console.log('--- done ---')
