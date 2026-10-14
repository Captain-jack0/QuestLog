module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  env: { browser: true, es2022: true },
  ignorePatterns: ['dist'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Raw Tailwind size names are not generated (tailwind.config.js defines type roles only),
    // so a leaked `text-sm` would silently do nothing. Fail it in CI instead.
    'no-restricted-syntax': [
      'error',
      ...[
        ['Literal', 'value'],
        ['TemplateElement', 'value.raw'],
      ].map(([type, prop]) => ({
        selector: `${type}[${prop}=/\\btext-(2xs|xs|sm|base|lg|xl|[2-9]xl)\\b/]`,
        message:
          'Raw Tailwind text size (text-xs, text-sm, ...). Use a type role: text-micro, caption, body, body-medium, lead, lead-mobile, title-md, title-lg, display-sm, display-lg(-mobile).',
      })),
    ],
  },
}
