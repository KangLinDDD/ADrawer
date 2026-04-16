import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';

const config = [
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'umd',
      name: 'ImageAnnotationDrawer',
      sourcemap: false,
      extend: true,
      exports: 'named',
      footer: 'if (typeof ImageAnnotationDrawer !== "undefined" && ImageAnnotationDrawer.default) { ImageAnnotationDrawer = ImageAnnotationDrawer.default; }',
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: false,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];

export default config;
