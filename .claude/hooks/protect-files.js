// PreToolUse hook: blocks Claude from editing secrets and live customer data.
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    filePath = JSON.parse(input).tool_input?.file_path || "";
  } catch {
    process.exit(0);
  }
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const protectedPatterns = [
    /(^|\/)local\.env$/,
    /(^|\/)\.env$/,
    /(^|\/)data\/(orders|customers)\.json$/
  ];
  if (protectedPatterns.some((re) => re.test(normalized))) {
    process.stderr.write(
      `Blocked: ${filePath} holds secrets or live customer data. Ask the user to edit it manually.\n`
    );
    process.exit(2);
  }
  process.exit(0);
});
