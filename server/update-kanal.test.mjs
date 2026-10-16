// update.sh mit Kanälen (main, Wartungszweig 1.x, feste Version) auf einem nachgebauten Server:
// Ordnerbaum unter KFR_ROOT, Git-Herkunft als lokales Repository, Releases als Dateien, systemctl/curl als Attrappen
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const here = new URL('.', import.meta.url).pathname

test('update.sh: Kanal main, 1.x und feste Version – App und Server folgen dem Kanal', { skip: !isRoot && 'nur als root' }, () => {
  const T = mkdtempSync(join(tmpdir(), 'kfr-kanal-'))
  try {
    const R = join(T, 'root')
    const bin = join(T, 'bin')
    const rel = join(T, 'releases')
    const work = join(T, 'work')
    const origin = join(T, 'origin.git')
    const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim()
    const commit = (msg) => {
      writeFileSync(join(work, 'stand.txt'), msg)
      git(work, 'add', '-A')
      git(work, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg)
      return git(work, 'rev-parse', 'HEAD')
    }

    // Herkunft: main (1.43.0 → später 2.0), Zweig 1.x mit Fehlerbehebung, Tag v1.43.0
    mkdirSync(join(work, 'server'), { recursive: true })
    git(T, 'init', '-q', '-b', 'main', work)
    cpSync(join(here, 'proxmox'), join(work, 'server/proxmox'), { recursive: true })
    writeFileSync(join(work, 'server/proxmox/backup.sh'), '#!/bin/sh\necho Sicherung\n')
    const v143 = commit('1.43.0')
    git(work, 'tag', 'v1.43.0')
    git(work, 'checkout', '-q', '-b', '1.x')
    const fix = commit('1.43.1')
    git(work, 'checkout', '-q', 'main')
    const v2 = commit('2.0.0')
    execFileSync('git', ['clone', '-q', '--bare', work, origin])

    // Server: läuft noch mit 1.43.0
    mkdirSync(join(R, 'opt'), { recursive: true })
    execFileSync('git', ['clone', '-q', origin, join(R, 'opt/koffer-fertig-raus')])
    git(join(R, 'opt/koffer-fertig-raus'), 'reset', '-q', '--hard', v143)

    // Releases als Dateien
    for (const [name, version] of [['app', '2.0.0'], ['app-1.x', '1.43.1'], ['v1.43.0', '1.43.0']]) {
      const d = join(T, 'zip', name)
      mkdirSync(d, { recursive: true })
      writeFileSync(join(d, 'index.html'), version)
      writeFileSync(join(d, 'app-version.txt'), `${version} abc\n`)
      mkdirSync(join(rel, name), { recursive: true })
      execFileSync('zip', ['-qr', join(rel, name, 'koffer-fertig-raus-app.zip'), '.'], { cwd: d })
    }

    // Attrappen: systemctl schreibt mit, curl meldet den Server gesund und lädt Releases aus Dateien
    mkdirSync(bin)
    writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "$*" >> ${join(T, 'systemctl.log')}\n`, { mode: 0o755 })
    const curl = execFileSync('sh', ['-c', 'command -v curl'], { encoding: 'utf8' }).trim()
    writeFileSync(join(bin, 'curl'), `#!/bin/sh\ncase "$*" in *8787*) exit 0 ;; esac\nexec ${curl} "$@"\n`, { mode: 0o755 })

    const env = { ...process.env, KFR_ROOT: R, KFR_RELEASES: `file://${rel}`, PATH: `${bin}:${process.env.PATH}` }
    const run = (...args) => {
      const r = spawnSync('bash', [join(R, 'opt/koffer-fertig-raus/server/proxmox/update.sh'), ...args], { env, encoding: 'utf8' })
      return { code: r.status, out: r.stdout + r.stderr }
    }
    const head = () => git(join(R, 'opt/koffer-fertig-raus'), 'rev-parse', 'HEAD')
    const app = () => readFileSync(join(R, 'opt/koffer-fertig-raus-app/index.html'), 'utf8')

    // Standard: main → neueste Fassung
    let r = run()
    assert.equal(r.code, 0, r.out)
    assert.equal(head(), v2)
    assert.equal(app(), '2.0.0')
    assert.equal(run('kanal').out.trim(), 'Kanal: main')

    // Wartungszweig 1.x
    r = run('kanal', '1.x')
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /Kanal ist jetzt: 1\.x/)
    assert.equal(head(), fix)
    assert.equal(app(), '1.43.1')
    assert.match(r.out, /Kanal: 1\.x \(zurück zur neuesten Fassung/)
    assert.equal(run('kanal').out.trim(), 'Kanal: 1.x')

    // Feste Version – weitere Updates ändern nichts
    r = run('version', '1.43.0')
    assert.equal(r.code, 0, r.out)
    assert.equal(head(), v143)
    assert.equal(app(), '1.43.0')
    r = run()
    assert.equal(r.code, 0, r.out)
    assert.equal(head(), v143)
    assert.match(r.out, /App ist aktuell \(1\.43\.0/)

    // „zurueck“ tauscht die App mit der vorigen; das nächste Update geht wieder auf den Kanal
    r = run('zurueck')
    assert.equal(app(), '1.43.1')
    r = run()
    assert.equal(app(), '1.43.0')

    // Falsche Angaben ändern nichts
    r = run('kanal', 'irgendwas')
    assert.equal(r.code, 1)
    r = run('version', '9.9.9')
    assert.equal(r.code, 1)
    assert.match(r.out, /gibt es nicht/)
    assert.equal(run('kanal').out.trim(), 'Kanal: v1.43.0')

    // Zurück zur neuesten Fassung
    r = run('kanal', 'main')
    assert.equal(r.code, 0, r.out)
    assert.equal(head(), v2)
    assert.equal(app(), '2.0.0')
    assert.equal(git(join(R, 'opt/koffer-fertig-raus'), 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
  } finally {
    rmSync(T, { recursive: true, force: true })
  }
})
