import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hand the built page its entry bundle's URL and UNCOMPRESSED size instead of
 * an ordinary <script src>, so the loading screen's bar can follow real bytes.
 *
 * The size has to come from here. Over a compressed response, content-length is
 * the COMPRESSED length while the stream reader yields decompressed bytes, and
 * a bar driven by that ratio finishes at about 380%.
 *
 * The call is MOVED to the end of the body, not left where the tag was. Vite
 * hoists the entry script into <head>, and pxBoot is defined by the loader's
 * own inline script at the foot of the body — calling it in the head throws a
 * ReferenceError before anything has loaded. The generated call still falls
 * back to a plain module tag if pxBoot is somehow missing, so a future change
 * to that ordering costs the progress bar rather than the whole module.
 *
 * Build only. The dev server has nothing to measure — it serves the module
 * graph unbundled — so the page keeps its plain tag there and the bar simply
 * starts when boot() does.
 *
 * It throws rather than passing the html through unchanged, because the failure
 * is otherwise invisible: the page still works, the bar just stops following
 * the download, and nobody finds out until someone watches it on a slow link.
 */
function entryProgressPlugin() {
    // Built with the RegExp constructor rather than a literal only to keep the
    // pattern readable next to all the quoting.
    const ENTRY_TAG = new RegExp(
        '<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*></script>');

    return {
        name: 'px-entry-progress',
        apply: 'build',
        enforce: 'post',
        transformIndexHtml(html, ctx) {
            const entry = Object.values(ctx.bundle ?? {})
                .find((out) => out.type === 'chunk' && out.isEntry);
            const bytes = entry ? Buffer.byteLength(entry.code, 'utf8') : 0;
            const match = html.match(ENTRY_TAG);

            if (!bytes || !match || !html.includes('</body>')) {
                throw new Error(
                    'px-entry-progress: no entry chunk, or the emitted script tag no '
                    + 'longer matches. Update ENTRY_TAG in trial/vite.config.js, or '
                    + 'the loading bar silently stops following the download.');
            }

            const src = JSON.stringify(match[1]);
            const call = '    <script>'
                + `if (window.pxBoot) { pxBoot(${src}, ${bytes}); }`
                + ' else { var s = document.createElement("script");'
                + ` s.type = "module"; s.src = ${src};`
                + ' document.body.appendChild(s); }'
                + '</script>\n  </body>';

            return html.replace(ENTRY_TAG, '').replace('</body>', call);
        },
    };
}

/**
 * The trial edition's build.
 *
 * `root` is this folder, so `trial/index.html` is the entry. `publicDir` and
 * every import still point at the shared tree one level up — that sharing is
 * the whole reason the trial lives here rather than in a forked repo.
 *
 * The build's base is RELATIVE, which the full edition's is not. A trial dist
 * is handed over as a folder and dropped wherever the host has room, so it
 * cannot know its own address at build time. Relative paths let index.html
 * resolve its bundle and its assets against the directory it was served from,
 * and the same folder then works at /gears-trial/, at a web root, and in a
 * local static server. An absolute base pinned at build time does not: served
 * from anywhere else the one module script 404s, nothing runs, and the loading
 * screen stays up forever, because the code that would take it away is the
 * code that failed to load.
 *
 * What relative paths do need is the trailing slash. /gears-trial/ resolves;
 * /physics-trial resolves one directory too high.
 *
 * TRIAL_BASE_PATH still pins an absolute base for a host that needs one, and it
 * has to come from PowerShell. Git Bash (MSYS) rewrites a value like
 * /gears-trial/ into "C:/Program Files/Git/gears-trial/" before Node
 * sees it, the build goes green, and every asset 404s once deployed:
 *     $env:TRIAL_BASE_PATH='/gears-trial/'; npm run build:trial
 */
export default defineConfig(({ command, mode, isPreview }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const override = process.env.TRIAL_BASE_PATH ?? env.TRIAL_BASE_PATH ?? '';

    if (override && /[\s:\\]/.test(override)) {
        throw new Error(
            `TRIAL_BASE_PATH was rewritten before Vite saw it: ${JSON.stringify(override)}\n`
            + 'This is Git Bash (MSYS) path conversion. Build from PowerShell:\n'
            + "    $env:TRIAL_BASE_PATH='/gears-trial/'; npm run build:trial");
    }

    // Preview serves the built dist from its own root, which is what a relative
    // base already expects, so it only needs a sub-path when one was pinned.
    const base = command === 'build' ? (override || './')
        : isPreview && override ? override
        : '/';

    return {
        root: __dirname,
        base,
        publicDir: '../public',
        plugins: [basicSsl(), entryProgressPlugin()],
        server: { https: true, host: true },
        preview: { https: true, host: true },
        build: {
            outDir: '../dist-trial',
            emptyOutDir: true,      // outDir is outside root, so Vite asks
        },
        resolve: { dedupe: ['three'] },
        optimizeDeps: {
            include: [
                'three',
                'three/addons/controls/OrbitControls.js',
                'three/addons/webxr/XRControllerModelFactory.js',
                'three/addons/webxr/XRHandModelFactory.js',
            ],
        },
    };
});
