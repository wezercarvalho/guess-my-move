import { defineConfig } from 'vite'
import base from './vite.config.js'

/** Experimental control for #147; never used by the production build. */
export default defineConfig({
    ...base,
    build: {
        ...base.build,
        outDir: 'dist-profile',
        rolldownOptions: {
            ...(base.build?.rollupOptions?.input ? { input: base.build.rollupOptions.input } : {}),
            output: {
                codeSplitting: {
                    groups: [{ name: 'three-vendor', test: /node_modules\/three\// }],
                },
            },
        },
    },
})
