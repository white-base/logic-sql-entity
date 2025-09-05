import { SQLContext } from '../src/sql-context.js'

// Build contexts A..G
const A = new SQLContext('A')
const B = new SQLContext('B')
const C = new SQLContext('C')
const D = new SQLContext('D')
const E = new SQLContext('E')
const F = new SQLContext('F')
const G = new SQLContext('G')

// Dependencies (uses): parent.contexts.add(child)
// C uses A and B
C.contexts.add('A', A)
C.contexts.add('B', B)

// E uses A and D
E.contexts.add('A', A)
E.contexts.add('D', D)

// F uses E
F.contexts.add('E', E)

// G uses D
G.contexts.add('D', D)

// entry uses E, F, G, C in that order (idx:0..3)
const entry = new SQLContext('entry')
entry.contexts.add('E', E)
entry.contexts.add('C', C)
entry.contexts.add('F', F)
entry.contexts.add('G', G)

var list = entry.getLoadContext().map(v=>v._name)
console.log(list) // expect [A, B, C, D, E, F, G] order by contexts order
//  ['A', 'D', 'E', 'F', 'G', 'B', 'C', 'entry']

function names(list){ return list.map(v => v._name) }

console.log('Unload C (idx:3) => expect [B, C]')
console.log(names(entry.getUnloadContext(0)))

console.log('Unload E (idx:0) => expect [] because F uses E')
console.log(names(entry.getUnloadContext(1)))

console.log('Unload F (idx:1) => expect [F]')
console.log(names(entry.getUnloadContext(2)))

console.log('Unload G (idx:2) => expect [G] because E uses D')
console.log(names(entry.getUnloadContext(3)))

console.log('Unload this')
console.log(names(entry.getUnloadContext(entry)))

// Simulate full sequence: remove G, then F, then E, then C
// After removing G and F from the entry (for analysis), compute for E and C
// Note: we just emulate by building active roots manually per call

// After removing G and F, active roots are [E, C]

// const entryAfterGF = new SQLContext('entryAfterGF')
// entryAfterGF.contexts.add('E', E)
// entryAfterGF.contexts.add('C', C)
// console.log('Unload E (after G,F removed) => expect [D, E]')
// console.log(names(entryAfterGF.getUnloadContext(0)))

// // After removing E too, active roots are [C]
// const entryAfterGFE = new SQLContext('entryAfterGFE')
// entryAfterGFE.contexts.add('C', C)
// console.log('Unload C (after E removed) => expect [B, A, C] order by contexts order')
// console.log(names(entryAfterGFE.getUnloadContext(0)))
console.log('--- now remove from entry ---')


console.log('remove G')
console.log('release: ' + names(entry.getUnloadContext(3))) // expect [G] because E uses D
entry.contexts.removeAt(3)
var list = entry.getLoadContext().map(v=>v._name)
console.log(list) // expect [A, B, C, D, E, F] order by contexts order

console.log('remove F')
console.log('release: ' + names(entry.getUnloadContext(2))) // expect [F]
entry.contexts.removeAt(2)
var list = entry.getLoadContext().map(v=>v._name)
console.log(list) // expect [A, B, C, D, E] order by contexts order

console.log('remove E')
console.log('release: ' + names(entry.getUnloadContext(1))) // expect [D, E] because F uses E
entry.contexts.removeAt(1)
var list = entry.getLoadContext().map(v=>v._name)
console.log(list) // expect [A, B, C] order by contexts order

console.log('remove C')
console.log('release: ' + names(entry.getUnloadContext(0))) // expect [B, A, C] order by contexts order
entry.contexts.removeAt(0)
var list = entry.getLoadContext().map(v=>v._name)
console.log(list) // expect [] order by contexts order
console.log('--- done ---')

