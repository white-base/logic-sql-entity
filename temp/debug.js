const identToken = '(?:"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|`[^`]*`|\\\[[^\\\]]+\\\]|[A-Za-z_][A-Za-z0-9_]*)';
const reFromJoin = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\b\\s+((?:${identToken}\\.)?)(${identToken})`, 'gi');
const reLeftOfDot = new RegExp(`\\b(${identToken})\\b(?=\\.)`, 'g');
const q1 = 'SELECT MAX("prt_id") AS "max_prt_id" FROM "prt_master";';
const q2 = 'SELECT "prt_master"."prt_id" FROM "prt_master";';
console.log('reFromJoin:', reFromJoin);
console.log('reLeftOfDot:', reLeftOfDot);
console.log('match1:', q1.match(reFromJoin));
console.log('match2:', q2.match(reLeftOfDot));
