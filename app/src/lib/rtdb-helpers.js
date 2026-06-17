import {
  ref,
  set,
  update,
  push,
  onValue,
  remove,
  get,
  serverTimestamp,
} from 'firebase/database'
import { database } from './firebase'

/**
 * 모든 경로는 rooms/{roomCode}/... 하위로 자동 스코프됨.
 * roomCode는 호출 측에서 명시적으로 넘긴다.
 */

const room = (roomCode, path = '') =>
  ref(database, `rooms/${roomCode}${path ? '/' + path : ''}`)

// 경로 아래에 새 push 키로 데이터 생성, 키 반환
export async function pushUnder(roomCode, path, data) {
  const r = push(room(roomCode, path))
  await set(r, { ...data, createdAt: serverTimestamp() })
  return r.key
}

// 특정 경로에 데이터 덮어쓰기
export async function setAt(roomCode, path, data) {
  await set(room(roomCode, path), data)
}

// 부분 업데이트
export async function updateAt(roomCode, path, partial) {
  await update(room(roomCode, path), partial)
}

// 특정 경로 한 번 조회 (스냅샷 값 반환)
export async function getOnce(roomCode, path) {
  const snap = await get(room(roomCode, path))
  return snap.val()
}

// 실시간 구독 (해제 함수 반환)
export function subscribe(roomCode, path, callback) {
  return onValue(room(roomCode, path), (snap) => callback(snap.val()))
}

// 삭제
export async function removeAt(roomCode, path) {
  await remove(room(roomCode, path))
}
