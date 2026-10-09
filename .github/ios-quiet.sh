# For .github/workflows/ios.yml: runs one xcodebuild step with its
# thousands of lines kept in a file, and prints only the result, or what
# went wrong if it failed.
quiet() {
  local name="$1"; shift
  local log="$RUNNER_TEMP/$name.log"
  if "$@" > "$log" 2>&1; then
    grep -E "SUCCEEDED|Upload|Uploaded" "$log" | tail -5 || true
  else
    echo "::error::$name failed"
    grep -E "error:|error -|FAILED|No signing|provisioning|certificate" "$log" | head -60 || true
    echo "--- last lines ---"
    tail -60 "$log"
    return 1
  fi
}
