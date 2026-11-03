/**
 * Runs the Android project's Gradle wrapper on any OS (npm scripts can't call `gradlew` portably):
 *   node scripts/gradle.cjs assembleDebug
 */
const { spawnSync } = require('child_process');
const path = require('path');

const cwd = path.join(__dirname, '..', 'android');
const windows = process.platform === 'win32';
// Absolute path: Windows may be set not to run programs from the current folder. A .bat needs a shell.
const wrapper = path.join(cwd, windows ? 'gradlew.bat' : 'gradlew');
const result = spawnSync(windows ? `"${wrapper}"` : wrapper, process.argv.slice(2), { cwd, stdio: 'inherit', shell: windows });
process.exit(result.status ?? 1);
