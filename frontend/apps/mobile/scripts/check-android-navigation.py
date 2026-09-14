"""Check the normal signed-in APK without fixtures, data resets or account writes.

Usage: python3 scripts/check-android-navigation.py --serial DEVICE_SERIAL
Requires adb, Maestro and its Java runtime on PATH. Evidence stays in .artifacts.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    mobile = Path(__file__).resolve().parents[1]
    output = args.output or mobile / '.artifacts' / (
        'navigation-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    )
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    adb = ['adb'] + (['-s', args.serial] if args.serial else [])
    subprocess.run([*adb, 'get-state'], check=True, capture_output=True)
    started = subprocess.check_output(
        [*adb, 'shell', "date '+%m-%d %H:%M:%S.000'"], text=True,
    ).strip()
    maestro = ['maestro'] + (['--device', args.serial] if args.serial else [])
    result = subprocess.run([
        *maestro, 'test', '--test-output-dir', str(output / 'maestro'),
        str(mobile / '.maestro-release/native-profile-friends-navigation.yaml'),
    ], check=False)
    log = subprocess.check_output(
        [*adb, 'logcat', '-d', '-T', started, '-v', 'threadtime'],
        text=True, errors='replace',
    )
    (output / 'phone.log').write_text(log)
    # Fabric may break the entire screen tree without terminating the process.
    # A surviving PID and the absence of FATAL EXCEPTION are insufficient.
    patterns = {
        'fatalException': r'FATAL EXCEPTION',
        'nativeViewOwnership': r'View already has a parent',
        'nativeViewRemoval': r'removeViewAt tried to remove',
        'fabricMountFailure': r' E .*SurfaceMountingManager:.*(?:Exception|Error|failed)',
        'appNotResponding': r'ANR in com\.pokegonexus\.app',
    }
    failures = {name: len(re.findall(pattern, log)) for name, pattern in patterns.items()}
    passed = result.returncode == 0 and not any(failures.values())
    summary = {
        'passed': passed,
        'maestroExitCode': result.returncode,
        'runtimeFailures': failures,
        'accountDataCleared': False,
        'accountEditsSubmitted': False,
    }
    (output / 'result.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2), flush=True)
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
