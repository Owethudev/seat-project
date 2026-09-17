let lockTail = Promise.resolve();

function runExclusive(operation) {
  const previousOperation = lockTail;
  let releaseLock;

  lockTail = new Promise((resolve) => {
    releaseLock = resolve;
  });

  return previousOperation
    .then(operation)
    .finally(releaseLock);
}

module.exports = {
  runExclusive
};
