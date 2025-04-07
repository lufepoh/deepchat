/**
 * 고유한 ID를 생성합니다.
 * @returns {string} 타임스탬프와 랜덤 문자열을 조합한 고유 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
} 