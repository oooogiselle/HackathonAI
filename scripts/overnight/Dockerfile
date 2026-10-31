# Sandbox for the overnight pipeline: Node + Playwright's Chromium (for pnpm test:e2e),
# pnpm, git and the Claude Code CLI. No credentials are baked in; the orchestrator passes
# only the Claude token at run time. Build: pnpm overnight:image
#
# The Playwright tag matches @playwright/test in package.json; bump both together.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# AI SDK 7 needs Node 22+.
RUN node -e "if (+process.versions.node.split('.')[0] < 22) { console.error('Node 22+ needed, got ' + process.version); process.exit(1) }"

RUN npm install -g pnpm@10.10.0 @anthropic-ai/claude-code \
  && git config --system safe.directory '*' \
  && mkdir -p /pnpm-store /home/agent && chmod 1777 /pnpm-store /home/agent

ENV CI=1 \
  DISABLE_AUTOUPDATER=1 \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  npm_config_store_dir=/pnpm-store \
  npm_config_package_import_method=copy \
  PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
