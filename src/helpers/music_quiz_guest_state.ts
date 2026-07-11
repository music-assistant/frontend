let joinedGameEnded = false;

export function markMusicQuizJoinedGameEnded() {
  joinedGameEnded = true;
}

export function consumeMusicQuizJoinedGameEnded() {
  const ended = joinedGameEnded;
  joinedGameEnded = false;
  return ended;
}
