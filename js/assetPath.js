/**
 * Resolve a file in public/ against the path the site is deployed under.
 *
 * BASE_URL is whatever `base` was at build time and is "/" in dev, so this is a
 * no-op there. It always ends in a slash, hence the slashless argument.
 *
 * Every runtime path string has to come through here. The bundler rewrites
 * imports and src= attributes; it never sees a path the code builds at runtime,
 * so it cannot fix one and cannot warn about it either. Written with a leading
 * slash it asks the web ROOT for a file that lives under /<slug>/ — which works
 * perfectly on a dev server that IS the root, and 404s the moment it deploys.
 * The only symptom is missing audio or an untextured surface, with a console
 * error nobody reads on a headset.
 */
export const asset = (path) => `${import.meta.env.BASE_URL}${path}`;
