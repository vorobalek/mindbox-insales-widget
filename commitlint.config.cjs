module.exports = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: false,
  ignores: [(message) => message.startsWith('Merge ')]
};
