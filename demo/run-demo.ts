import { createServer } from './server.js';
import { runAgentSimulation, getAuditSummary } from './agent.js';
import type { StepResult } from './agent.js';
import * as http from 'http';

// ANSI escape codes
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function bold(s: string) { return `${BOLD}${s}${RESET}`; }
function dim(s: string) { return `${DIM}${s}${RESET}`; }
function green(s: string) { return `${GREEN}${s}${RESET}`; }
function yellow(s: string) { return `${YELLOW}${s}${RESET}`; }
function red(s: string) { return `${RED}${s}${RESET}`; }
function cyan(s: string) { return `${CYAN}${s}${RESET}`; }

function separator(char = '─', width = 70): string {
  return char.repeat(width);
}

function printHeader() {
  console.log('');
  console.log(bold(`🏨  Agent Gateway Demo — Paradise Resort & Spa`));
  console.log(bold(separator('═')));
  console.log(dim('  An AI agent negotiates access and performs actions on behalf of a resort guest'));
  console.log(dim('  Watch how delegation, escalation, and denial all work in real time'));
  console.log('');
}

function statusColor(status: string): string {
  if (status === 'success') return green(status.toUpperCase());
  if (status === 'escalation_required') return yellow(status.toUpperCase());
  if (status === 'denied') return red(status.toUpperCase());
  if (status === 'error') return red(status.toUpperCase());
  return cyan(status.toUpperCase());
}

function printStep(step: StepResult) {
  console.log(bold(`  Step ${step.step}: ${step.title} ${step.emoji}`));
  console.log(dim('  ' + separator('─', 66)));

  for (const detail of step.details) {
    if (detail) {
      // Highlight the status line
      if (detail.startsWith('Status:')) {
        const statusVal = detail.replace('Status: ', '').trim();
        console.log(`    → Status: ${statusColor(statusVal)}`);
      } else if (detail.startsWith('[Guest approves]')) {
        console.log(`    ${cyan('→')} ${cyan(detail)}`);
      } else {
        console.log(`    → ${detail}`);
      }
    }
  }

  if (step.delegation_check) {
    console.log('');
    const check = step.delegation_check;
    let label: string;
    if (check.startsWith('PERMITTED')) {
      label = green('✓ ' + check);
    } else if (check.startsWith('ESCALATED')) {
      label = yellow('⚡ ' + check);
    } else if (check.startsWith('DENIED')) {
      label = red('✗ ' + check);
    } else {
      label = dim(check);
    }
    console.log(`    ${dim('Delegation check:')} ${label}`);
  }

  console.log('');
}

function printAuditSummary(summary: Record<string, unknown>) {
  console.log(bold(separator('═')));
  console.log(bold('  📋  Audit Summary'));
  console.log(dim('  ' + separator('─', 66)));

  const total = summary.total_requests as number;
  const byStatus = summary.by_status as Record<string, number>;
  const byAction = summary.by_action as Record<string, number>;
  const totalAmount = summary.total_amount as number;
  const escalations = summary.escalations as number;

  console.log(`    Total requests processed: ${bold(String(total))}`);
  console.log(`    Total transaction amount: ${bold('$' + totalAmount.toFixed(2))}`);
  console.log(`    Escalations triggered:    ${escalations > 0 ? yellow(String(escalations)) : String(escalations)}`);
  console.log('');
  console.log(`    ${bold('Results by status:')}`);

  for (const [status, count] of Object.entries(byStatus)) {
    let coloredStatus: string;
    if (status === 'success') coloredStatus = green(status.padEnd(22));
    else if (status === 'escalation_required') coloredStatus = yellow(status.padEnd(22));
    else if (status === 'denied') coloredStatus = red(status.padEnd(22));
    else coloredStatus = status.padEnd(22);
    console.log(`      ${coloredStatus} ${count}`);
  }

  console.log('');
  console.log(`    ${bold('Actions executed:')}`);
  for (const [action, count] of Object.entries(byAction)) {
    console.log(`      ${action.padEnd(38)} ${count}`);
  }

  console.log('');
  console.log(bold(separator('═')));
  console.log('');
}

async function main() {
  printHeader();

  // Start server on a random available port
  const app = createServer();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  console.log(dim(`  Server started on ${baseUrl}`));
  console.log('');

  try {
    const steps = await runAgentSimulation(baseUrl);

    for (const step of steps) {
      printStep(step);
    }

    const summary = await getAuditSummary(baseUrl);
    printAuditSummary(summary);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(red('Demo failed:'), err);
  process.exit(1);
});
