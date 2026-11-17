/*! tinyproctor.js ESM entry. Loads the classic script (which sets window.TinyProctor) and re-exports it.
 * Imported this way it never auto-starts: call TinyProctor.init({ ... }) yourself. */
import './tinyproctor.js'

const TinyProctor = globalThis.TinyProctor
export default TinyProctor
export { TinyProctor }
