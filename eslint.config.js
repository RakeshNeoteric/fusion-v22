// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Architecture boundaries (see README "Architecture").
 * Dependencies point inward: features -> shared/core -> api. Never the other way.
 */
const noFeatureImports = {
  group: ['@features/*', '**/features/**'],
  message: 'core/shared/api must not depend on features. Move the shared piece down a layer.',
};
const noEnvironmentImports = {
  group: ['**/environments/*'],
  message:
    'Read configuration through the APP_CONFIG injection token (core/config), not environment files.',
};

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      // Typed linting: required by type-aware rules such as no-uncalled-signals.
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // Angular 22 conventions
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/use-injectable-provided-in': 'error',

      // Type safety
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Hygiene
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],

      'no-restricted-imports': ['error', { patterns: [noEnvironmentImports] }],
    },
  },
  {
    files: ['src/app/core/**/*.ts', 'src/app/shared/**/*.ts', 'src/app/api/**/*.ts'],
    ignores: ['src/app/core/config/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noFeatureImports, noEnvironmentImports] }],
    },
  },
  {
    // The config layer is the only place allowed to read environment files.
    files: ['src/app/core/config/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noFeatureImports] }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/no-any': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/button-has-type': 'error',
      '@angular-eslint/template/eqeqeq': 'error',
    },
  },
]);
