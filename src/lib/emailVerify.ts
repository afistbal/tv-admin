/** 与 slot_old `src/utils.ts` 一致 */
export function emailVerify(email: string): boolean {
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(email.trim());
}
