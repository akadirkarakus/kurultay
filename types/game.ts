export type GameStatus = "lobby" | "deck_selection" | "in_round" | "round_result" | "finished";

export interface GameSummary {
  id: string;
  roomCode: string;
  status: GameStatus;
  currentRound: number;
  maxRounds: number;
  rematchReadyPlayerIds: string[];
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
  jokerUsed: boolean;
  usedJoker: { key: string; name: string; targetNickname: string | null } | null;
}

export interface MeSummary {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  deck: string[];
  usedCharacters: string[];
  score: number;
}

export interface CharacterSummary {
  id: string;
  name: string;
  category?: string;
  image_url: string | null;
  attributes?: Record<string, number>;
}

export interface RoundPickReveal {
  playerId: string;
  characterId: string;
  character: { id: string; name: string; image_url: string | null } | null;
  average: number | null;
  isAutoPick: boolean;
}

export interface RoundViewPicking {
  roundNumber: number;
  scenarioText: string;
  keyAttributes: string[];
  deadlineAt: string | null;
  status: "picking";
  myPick: string | null;
  pickedPlayerIds: string[];
}

export interface RoundViewResolved {
  roundNumber: number;
  scenarioText: string;
  keyAttributes: string[];
  deadlineAt: string | null;
  status: "resolving" | "resolved";
  myPick: string | null;
  picks: RoundPickReveal[];
  winnerCommentary: string | null;
  continueDeadlineAt: string | null;
  continueReadyPlayerIds: string[];
}

export interface JokerCatalogEntry {
  key: string;
  name: string;
  description: string;
  imageUrl: string;
  needsOwnCharacter: boolean;
  needsTargetPlayer: boolean;
}

export interface RoundViewJokerWindow {
  roundNumber: number;
  scenarioText: string;
  keyAttributes: string[];
  status: "joker_window";
  jokerDeadlineAt: string | null;
  myJokerAvailable: boolean;
  myDecidedThisRound: boolean;
  decidedPlayerIds: string[];
  availableJokers: JokerCatalogEntry[];
  myDeck: CharacterSummary[];
  opponents: { id: string; nickname: string; isBot: boolean }[];
}

export type RoundView = RoundViewPicking | RoundViewResolved | RoundViewJokerWindow;

export interface DraftView {
  stepNumber: number;
  totalSteps: number;
  category: string | null;
  categories: string[];
  deadlineAt: string | null;
  myOffer: CharacterSummary[];
  myPicksSoFar: string[];
  myPickForCurrentStep: string | null;
  pickedPlayerIds: string[];
}

export interface GameStateResponse {
  game: GameSummary;
  players: PlayerSummary[];
  me: MeSummary;
  round: RoundView | null;
  draft: DraftView | null;
}
