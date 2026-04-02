import readline from 'readline';

/** Skip prompt when --yes or -y (CI / automation). */
export function hasYesFlag() {
  return process.argv.includes('--yes') || process.argv.includes('-y');
}

/**
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const onSigInt = () => {
      rl.close();
      console.log('');
      process.exit(0);
    };
    process.once('SIGINT', onSigInt);
    rl.question(message + ' (y/n) ', (answer) => {
      process.removeListener('SIGINT', onSigInt);
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
