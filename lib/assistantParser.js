// Bridge module to maintain legacy import path while using the canonical parser in app/lib
export { parseUserRequest } from '@/app/lib/assistantParser'
const parserExport = { parseUserRequest }
export default parserExport
