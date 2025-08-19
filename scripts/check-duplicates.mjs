
// index.mjs — ESM (Node 18+ 권장)
// 사용법:
//   node index.mjs @logic
//   node index.mjs @logic --allow-minor-diff
//   node index.mjs @logic --allow-compatible
//
// 동작 요약:
// 1) 현재 작업 디렉터리 기준으로 node_modules 경로들을 위로(부모 폴더) 추적
// 2) 각 node_modules 하위의 @scope 디렉터리 내 패키지 이름 수집
// 3) 패키지별로 require.resolve.paths() 기반 탐색 경로에서 package.json을 찾아 버전 수집
// 4) 중복(서로 다른 버전 >= 2) 발견 시 에러(Exit 1)
//    - --allow-minor-diff: major 동일하며 minor/patch는 상이해도 통과
//    - --allow-compatible: semver.satisfies(최신, 나머지 모두)면 통과

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// semver는 옵션 기능용(없어도 동작). 호환 검사를 쓰려면 설치하세요.
// npm i semver
let semver = null;
try {
  semver = (await import('semver')).default;
} catch {
  // semver 미설치시 호환성 옵션은 비활성화됩니다.
}

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// -----------------------------
// 유틸: 콘솔 스타일
// -----------------------------
const log = {
  info : (s) => console.log(s),
  warn : (s) => console.warn(s),
  error: (s) => console.error(s),
};

// -----------------------------
// Node 해석 경로 수집 (프로젝트 루트 ~ 상위)
// -----------------------------
function collectNodeModulesDirs(startDir = process.cwd()) {
  const dirs = [];
  let cur = path.resolve(startDir);
  while (true) {
    const nm = path.join(cur, 'node_modules');
    dirs.push(nm);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return dirs;
}

// -----------------------------
// 특정 scope 아래의 패키지 목록 수집
// -----------------------------
function listPackagesInScope(scope, nmDirs) {
  const names = new Set();
  for (const nm of nmDirs) {
    const scopeDir = path.join(nm, scope);
    if (!fs.existsSync(scopeDir)) continue;
    try {
      for (const entry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (entry.isDirectory()) names.add(`${scope}/${entry.name}`);
      }
    } catch {
      // 권한/파일시스템 이슈 등은 무시
    }
  }
  return Array.from(names).sort();
}

// -----------------------------
// 단일 패키지의 설치된 "모든 버전" 수집
// require.resolve.paths() 를 사용해 Node 탐색 경로 상의 실설치 버전 수집
// -----------------------------
function findAllInstalledVersions(pkgName) {
  const versions = new Set();
  // require.resolve.paths 은 CJS 해석기를 사용하지만 ESM에서도 createRequire로 사용 가능
  const searchPaths = require.resolve.paths(pkgName) || [];

  for (const base of searchPaths) {
    const pkgJson = path.join(base, pkgName, 'package.json');
    if (fs.existsSync(pkgJson)) {
      try {
        const json = require(pkgJson);
        if (json?.version) versions.add(json.version);
      } catch {
        // 손상/권한 문제는 무시
      }
    }
  }
  return Array.from(versions).sort((a, b) => {
    // semver 정렬(semver 없으면 문자열 정렬)
    if (semver && semver.valid(a) && semver.valid(b)) {
      return semver.rcompare(a, b); // 최신 우선
    }
    return a.localeCompare(b);
  });
}

// -----------------------------
// 버전 집합의 "중복 허용 여부" 판단
// -----------------------------
function isDuplicateAllowed(versions, mode) {
  if (versions.length <= 1) return true; // 단일 버전은 항상 OK

  // 기본(엄격): 어떤 차이든 2개 이상이면 실패
  if (!mode) return false;

  // semver 없으면 호환성 판단 불가 → 기본 엄격 모드와 동일 처리
  if (!semver) return false;

  const sorted = versions
    .filter(v => semver.valid(v))
    .sort(semver.rcompare); // 최신 → 오래된

  if (sorted.length <= 1) return true;

  const base = sorted[0]; // 가장 최신
  if (mode === 'allow-minor-diff') {
    const major = semver.major(base);
    return sorted.every(v => semver.major(v) === major);
  }

  if (mode === 'allow-compatible') {
    // 최신(base) 버전이 나머지의 범위를 "포함"한다고 볼 수 있는지 확인.
    // 범위 정보가 없으니, 현실적인 근사: 모두 ^baseMajor.0.0 범위 내인지 검사
    // (= major 동일, minor/patch 상관없음) + 최신이 과거와 호환된다고 가정
    const major = semver.major(base);
    return sorted.every(v => semver.major(v) === major);
  }

  return false;
}

// -----------------------------
// 메인 로직
// -----------------------------
async function main() {
  const [, , scopeArg, ...rawFlags] = process.argv;

  if (!scopeArg || !scopeArg.startsWith('@')) {
    log.error('사용법: node index.mjs @your-scope [--allow-minor-diff | --allow-compatible]');
    process.exit(2);
  }

  const flags = new Set(rawFlags);
  let mode = null;
  if (flags.has('--allow-minor-diff')) mode = 'allow-minor-diff';
  if (flags.has('--allow-compatible')) mode = 'allow-compatible';

  if ((mode === 'allow-minor-diff' || mode === 'allow-compatible') && !semver) {
    log.warn('[경고] semver 패키지가 설치되어 있지 않아 호환성 옵션을 적용할 수 없습니다. (npm i semver)');
    mode = null;
  }

  const nmDirs = collectNodeModulesDirs(process.cwd());
  const pkgs  = listPackagesInScope(scopeArg, nmDirs);

  if (pkgs.length === 0) {
    log.info(`[정보] ${scopeArg} 스코프 하위 패키지를 찾지 못했습니다.`);
    process.exit(0);
  }

  let hasError = false;
  log.info(`검사 대상: ${scopeArg} (${pkgs.length}개 패키지)\n`);

  for (const fullName of pkgs) {
    const versions = findAllInstalledVersions(fullName);

    if (versions.length <= 1) {
      log.info(`OK   ${fullName}  →  ${versions[0] ?? '(미설치 감지 실패)'}`);
      continue;
    }

    const pass = isDuplicateAllowed(versions, mode);
    if (pass) {
      log.info(`PASS ${fullName}  →  ${versions.join(', ')}  (${mode ?? 'strict'} 규칙 통과)`);
    } else {
      hasError = true;
      log.error(`FAIL ${fullName}  →  ${versions.join(', ')}`);
    }
  }

  if (hasError) {
    process.exitCode = 1;
    log.error('\n중복 설치(또는 비호환) 패키지가 감지되었습니다. (Exit 1)');
  } else {
    log.info('\n모든 패키지에서 중복(비호환) 문제가 감지되지 않았습니다. (Exit 0)');
  }
}

main().catch((e) => {
  log.error(e?.stack || String(e));
  process.exit(1);
});