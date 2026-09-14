import { defineConfig, loadEnv } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Built to be deployed as a plain static directory under /<slug>/, per the
 * Module Build & Handoff Guide.
 *
 * `base` comes from BASE_PATH and is applied to BUILDS and `vite preview` only.
 * The dev server stays at the root of its port: moving it to /<slug>/ would
 * break every bookmarked headset URL and buy nothing. `command` is 'serve' for
 * preview as well, hence the isPreview arm.
 *
 * The /api proxy is declared for BOTH server and preview. Leaving it off
 * preview is why a correct build appears to fail with "failed to load quiz" —
 * the build is fine, the preview server just has nowhere to send /api.
 * LMS_ORIGIN is SERVER-SIDE — Vite fetches it from Node, so it never reaches a
 * browser and an absolute http:// URL is safe here. It is the only place in the
 * build where that is true. Per the guide's address table:
 *
 *   http://127.0.0.1:5000        backend on this same machine
 *   http://parallaxed.local:5000 from your own laptop (mDNS, survives DHCP)
 *   http://192.168.0.232:5000    same, but the lease will eventually move
 *
 * Defaulting to the mDNS name rather than loopback: whoever builds this is
 * usually NOT on the classroom machine. Origin only — no path, no trailing
 * slash; the backend expects to see the /api prefix itself.
 */
export default defineConfig(({ command, mode, isPreview }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const basePath = process.env.BASE_PATH ?? env.BASE_PATH ?? '/';
    const base = command === 'build' || isPreview ? basePath : '/';

    const apiProxy = {
        '/api': {
            target: process.env.LMS_ORIGIN ?? env.LMS_ORIGIN ?? 'http://parallaxed.local:5000',
            changeOrigin: true,
        },
    };

    return {
        base,
        plugins: [basicSsl()],
        server: { https: true, host: true, proxy: apiProxy },
        preview: { https: true, host: true, proxy: apiProxy },
    };
});
