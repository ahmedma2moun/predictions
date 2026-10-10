#!/usr/bin/env python3
"""Native parity guard (see CLAUDE.md "Native Parity Rule").

Fails when a change touches native/ios/** but not native/android/** (or the reverse) unless the PR body
contains `Parity: ios-only — <reason>` or `Parity: android-only — <reason>`.

Env: BASE_SHA, HEAD_SHA, PR_BODY
"""
import os, re, subprocess, sys

base, head, body = os.environ["BASE_SHA"], os.environ["HEAD_SHA"], os.environ.get("PR_BODY") or ""
files = subprocess.run(["git", "diff", "--name-only", f"{base}...{head}"], capture_output=True, text=True, check=True).stdout.split()

ios = [f for f in files if f.startswith("native/ios/")]
android = [f for f in files if f.startswith("native/android/")]
print(f"iOS files changed: {len(ios)}, Android files changed: {len(android)}")

if bool(ios) == bool(android):
    print("Parity OK.")
    sys.exit(0)

side = "ios" if ios else "android"
if re.search(rf"Parity:\s*{side}-only\s*[—-]\s*\S+", body, re.IGNORECASE):
    print(f"Parity waiver found for {side}-only change.")
    sys.exit(0)

print(f"::error::This PR changes native/{side}/ only. Mirror the change in native/{'android' if side == 'ios' else 'ios'}/ "
      f"in the same PR, or add `Parity: {side}-only — <reason>` to the PR description (platform-specific code only).")
sys.exit(1)
