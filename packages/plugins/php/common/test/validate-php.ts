import { Engine } from 'php-parser';

export function validatePhp(content: string): void {
  /* eslint-disable no-console */
  const originalErr = console.error;
  const collectedErrors = [];
  console.error = (errorStr: string) => {
    collectedErrors.push(errorStr);
  };
  const parser = new Engine({
    // some options :
    parser: {
      extractDoc: true,
      php7: true,
    },
    ast: {
      withPositions: true,
    },
  });

  parser.parseEval(content);
  console.error = originalErr;
  /* eslint-enable no-console */

  if (collectedErrors.length > 0) {
    const mergedErrors = collectedErrors.join('\n');

    throw new Error(`Invalid Php code:\n${mergedErrors}`);
  }
}
