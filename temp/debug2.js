const tablePrefix='pre_';
const tableSuffix='_suf';
const excludeTables=[];
const caseSensitive=false;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => (caseSensitive ? s : s.toLowerCase());
const addAffix = (name, pre, suf) => {
  const hasPre = pre && name.startsWith(pre);
  const hasSuf = suf && name.endsWith(suf);
  return `${hasPre ? '' : pre}${name}${hasSuf ? '' : suf}`;
};
const stripAffix = (name, pre, suf) => {
  let out = name;
  if (pre && out.startsWith(pre)) out = out.slice(pre.length);
  if (suf && out.endsWith(suf)) out = out.slice(0, out.length - suf.length);
  return out;
};
const matchList = (name, list) => list.some((p) =>
  typeof p === 'string'
    ? norm(name) === norm(p)
    : p instanceof RegExp
      ? p.test(name)
      : false
);
const identToken = '(?:"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|`[^`]*`|\\\[[^\\\]]+\\\]|[A-Za-z_][A-Za-z0-9_]*)';
const unquote = (tok) => {
  if (!tok) return { name: '', quote: null };
  if (tok.startsWith('"') && tok.endsWith('"')) {
    return { name: tok.slice(1, -1).replace(/""/g, '"'), quote: '"' };
  }
  if (tok.startsWith('`') && tok.endsWith('`')) {
    return { name: tok.slice(1, -1), quote: '`' };
  }
  if (tok.startsWith('[') && tok.endsWith(']')) {
    return { name: tok.slice(1, -1), quote: '[]' };
  }
  return { name: tok, quote: null };
};
const rewrap = (name, quote) => {
  if (quote === '"') return `"${name.replace(/"/g, '""')}"`;
  if (quote === '`') return `\`${name}\``;
  if (quote === '[]') return `[${name}]`;
  return name;
};

const reFromJoin = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\b\\s+((?:${identToken}\\.)?)(${identToken})`, 'gi');
let s = 'SELECT MAX("prt_id") AS "max_prt_id" FROM "prt_master";';
console.log('before:', s);
console.log('reFromJoin:', reFromJoin);

s = s.replace(reFromJoin, (full, kw, schemaDot, tblTok) => {
  const { name: tblName, quote } = unquote(tblTok);
  const original = stripAffix(tblName, tablePrefix, tableSuffix);
  if (matchList(tblName, excludeTables)) {
    return `${kw} ${schemaDot || ''}${tblTok}`;
  }
  const affixed = addAffix(original, tablePrefix, tableSuffix);
  const outTok = rewrap(affixed, quote);
  return `${kw} ${schemaDot || ''}${outTok}`;
});
console.log('after:', s);
