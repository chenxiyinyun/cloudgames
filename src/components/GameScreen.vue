<template>
  <div class="screen active">
    <div class="game-container">
      <!-- 电报头部 -->
      <div class="telegram-header">
        <div class="telegram-icon">T</div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1.2rem; font-weight: 700;">TOP SECRET</div>
          <div class="morse-decoration">- --- .--. / ... . -.-. .-. . -</div>
        </div>
        <div class="telegram-icon">M</div>
      </div>

      <!-- 游戏头部 -->
      <div class="game-header">
        <div class="team-info white">
          <div class="team-name">白队</div>
          <div class="tokens">
            <div 
              v-for="i in 2" 
              :key="'white-intercept-' + i"
              class="token white"
              :class="{ 'earned': whiteInterceptTokens >= i }"
            ></div>
            <div style="width: 15px;"></div>
            <div 
              v-for="i in 2" 
              :key="'white-error-' + i"
              class="token black"
              :class="{ 'earned': whiteMiscommunicationTokens >= i }"
            ></div>
          </div>
        </div>
        <div class="round-info">
          <div class="round-number">第 {{ gameState.room.currentRound }} 回合</div>
          <div class="morse-decoration" style="font-size: 0.6rem;">.-. --- ..- -. -..</div>
        </div>
        <div class="team-info black">
          <div class="team-name">黑队</div>
          <div class="tokens">
            <div 
              v-for="i in 2" 
              :key="'black-intercept-' + i"
              class="token white"
              :class="{ 'earned': blackInterceptTokens >= i }"
            ></div>
            <div style="width: 15px;"></div>
            <div 
              v-for="i in 2" 
              :key="'black-error-' + i"
              class="token black"
              :class="{ 'earned': blackMiscommunicationTokens >= i }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 连接状态提示 -->
      <div v-if="connectionMessage && connectionStatus !== 'connected'" 
           class="connection-status" 
           :class="connectionStatus">
        {{ connectionMessage }}
      </div>

      <!-- 断线提示和重连按钮 -->
      <div v-if="!isOnline && !isPaused" class="disconnect-alert">
        <div class="disconnect-title">连接中断</div>
        <p class="disconnect-message">你与任务中心失去联系</p>
        <button class="btn btn-primary" @click="handleReconnect" :disabled="isReconnecting">
          {{ isReconnecting ? '重新连接中...' : '重新连接' }}
        </button>
      </div>

      <!-- 游戏暂停提示 -->
      <div v-if="isPaused" class="pause-alert">
        <div class="pause-title">任务暂停</div>
        <p class="pause-message">等待以下特工重新连接...</p>
        <div class="disconnected-players">
          <div v-for="player in disconnectedPlayers" :key="player.id" class="disconnected-player">
            <span class="player-name">{{ player.name }}</span>
            <span class="offline-badge">离线</span>
          </div>
        </div>
        <div class="online-players">
          <p style="font-size: 0.8rem; margin-bottom: 0.5rem;">已连接特工:</p>
          <div v-for="player in onlinePlayers" :key="player.id" class="online-player">
            <span class="player-name">{{ player.name }}</span>
            <span class="online-badge">在线</span>
          </div>
        </div>
        <button v-if="!isOnline" class="btn btn-primary" @click="handleReconnect" :disabled="isReconnecting">
          {{ isReconnecting ? '重新连接中...' : '重新连接' }}
        </button>
      </div>

      <!-- 当前情报官信息 -->
      <div v-if="currentEncryptorInfo && !isPaused" class="current-encryptor">
        <div class="current-encryptor-name">
          情报官: {{ currentEncryptorInfo.name }}
        </div>
        <div class="current-encryptor-team">
          {{ currentEncryptorInfo.teamName }} | 轮换顺序: {{ rotationOrder }}
        </div>
      </div>

      <!-- 在线玩家列表 -->
      <div class="online-players-bar">
        <div class="online-count">
          <span class="count-number">{{ onlinePlayerCount }}</span>
          <span class="count-total">/4</span>
        </div>
        <div class="player-avatars">
          <div v-for="player in allPlayers" :key="player.id" 
               class="player-avatar" 
               :class="{ online: player.isOnline, offline: !player.isOnline, you: player.id === gameState.playerId }">
            <span class="avatar-name">{{ player.name.charAt(0) }}</span>
            <span class="avatar-status"></span>
          </div>
        </div>
      </div>

      <div class="game-area" v-if="!isPaused">
        <!-- 我方关键词 -->
        <div class="screen-panel our-team">
          <div class="screen-title">{{ ourTeamLabel }} 密码本</div>
          <div class="keywords-grid">
            <div 
              v-for="(word, index) in ourKeywords" 
              :key="index"
              class="keyword-card visible"
            >
              <div class="keyword-number">{{ index + 1 }}</div>
              <div class="keyword-word">{{ word }}</div>
            </div>
          </div>
        </div>

        <!-- 阶段面板 -->
        <div class="phase-panel">
          <!-- 加密阶段 -->
          <template v-if="gameState.room.phase === 'encrypting'">
            <div v-if="gameState.isEncryptor" class="phase-content">
              <div class="encryptor-badge" style="margin-bottom: 1rem;">
                你是情报官
              </div>
              <div class="phase-title">破译密码</div>
              <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter); font-size: 0.9rem;">
                查看密码并给出 3 个线索
              </p>
              <div class="code-display">
                <div 
                  v-for="(digit, index) in gameState.room.currentCode" 
                  :key="index"
                  class="code-digit"
                >{{ digit }}</div>
              </div>
              <div class="clue-inputs">
                <div 
                  v-for="i in 3" 
                  :key="i"
                  class="clue-input-group"
                >
                  <div class="clue-index">{{ i }}</div>
                  <input 
                    type="text" 
                    class="clue-input-field" 
                    v-model="clues[i - 1]"
                    :placeholder="`第 ${i} 号线索`"
                  />
                </div>
              </div>
              <p class="rules-text">
                <strong>注意:</strong> 线索不能包含关键词，不能用拼音、谐音、字数等暗示！
              </p>
              <button class="btn btn-primary" @click="onCluesSubmit" style="width: 100%;">
                发送电报
              </button>
            </div>
            <div v-else-if="gameState.isTeammate" class="phase-content">
              <div class="phase-title">等待情报</div>
              <p style="text-align: center; font-family: var(--typewriter);">
                {{ encryptorName }} 正在加密情报...
              </p>
              <div class="morse-decoration" style="margin-top: 2rem;">
                .-- .- .. - .. -. --.
              </div>
            </div>
            <div v-else-if="gameState.isOpponent" class="phase-content">
              <div class="phase-title">敌方加密中</div>
              <p style="text-align: center; font-family: var(--typewriter);">
                准备拦截敌方密码！
              </p>
              <div class="morse-decoration" style="margin-top: 2rem;">
                .-- .- - -.-. ....
              </div>
            </div>
          </template>

          <!-- 猜测阶段 -->
          <template v-else-if="gameState.room.phase === 'guessing' || gameState.room.phase === 'team_voting'">
            <!-- 队友猜测 -->
            <div v-if="gameState.isTeammate && !hasSubmittedTeamGuess" class="phase-content">
              <div class="phase-title">解码情报</div>
              <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter);">
                根据线索猜出密码
              </p>
              <div class="clue-display">
                <div 
                  v-for="(clue, index) in gameState.room.clues" 
                  :key="index"
                  class="clue-item"
                >
                  <div class="clue-index">{{ index + 1 }}</div>
                  <div class="clue-text">{{ clue }}</div>
                </div>
              </div>
              <div class="code-inputs">
                <input 
                  v-for="i in 3" 
                  :key="i"
                  type="number" 
                  class="code-input" 
                  v-model="teammateGuess[i - 1]"
                  min="1" 
                  max="4" 
                  placeholder="?"
                />
              </div>
              <button class="btn btn-primary" @click="onTeammateGuessSubmit" style="width: 100%;">
                提交解码
              </button>
            </div>

            <!-- 对方拦截 -->
            <div v-else-if="gameState.isOpponent && !hasSubmittedOpponentGuess" class="phase-content">
              <div class="phase-title">拦截密码</div>
              <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter);">
                尝试猜出敌方密码
              </p>
              <div class="clue-display">
                <div 
                  v-for="(clue, index) in gameState.room.clues" 
                  :key="index"
                  class="clue-item"
                >
                  <div class="clue-index">{{ index + 1 }}</div>
                  <div class="clue-text">{{ clue }}</div>
                </div>
              </div>
              <div class="code-inputs">
                <input 
                  v-for="i in 3" 
                  :key="i"
                  type="number" 
                  class="code-input" 
                  v-model="opponentGuess[i - 1]"
                  min="1" 
                  max="4" 
                  placeholder="?"
                />
              </div>
              <button class="btn btn-primary" @click="onOpponentGuessSubmit" style="width: 100%;">
                发送拦截
              </button>
            </div>

            <!-- 拦截方投票 -->
            <div v-else-if="gameState.room.phase === 'team_voting' && gameState.isOpponent && needOpponentVote" class="phase-content">
              <div class="vote-panel">
                <div class="vote-title">拦截方投票</div>
                <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter); font-size: 0.9rem;">
                  拦截意见不一致，请统一决定
                </p>
                <div class="vote-options">
                  <div 
                    v-for="(option, index) in opponentVoteOptions" 
                    :key="'opp-' + index"
                    class="vote-option"
                    :class="{ selected: selectedOpponentVote === index }"
                    @click="selectOpponentVoteOption(index)"
                  >
                    <div class="clue-index">{{ index + 1 }}</div>
                    <div>{{ option.playerName }}: {{ option.guess.join(' - ') }}</div>
                  </div>
                  <!-- 自由输入选项 -->
                  <div 
                    class="vote-option custom-option"
                    :class="{ selected: selectedOpponentVote === opponentVoteOptions.length }"
                    @click="selectedOpponentVote = opponentVoteOptions.length"
                  >
                    <div class="clue-index">✎</div>
                    <div>自定义密码</div>
                  </div>
                </div>
                <!-- 自定义密码输入 -->
                <div v-if="selectedOpponentVote === opponentVoteOptions.length" class="custom-code-input" style="margin-top: 1rem;">
                  <div class="code-inputs">
                    <input 
                      v-for="i in 3" 
                      :key="'opp-custom-' + i"
                      type="number" 
                      class="code-input" 
                      v-model="customOpponentVoteGuess[i - 1]"
                      min="1" 
                      max="4" 
                      placeholder="?"
                    />
                  </div>
                </div>
                <button class="btn btn-primary" @click="onOpponentVoteSubmit" style="width: 100%; margin-top: 1rem;">
                  确认统一密码
                </button>
              </div>
            </div>

            <!-- 投票阶段 -->
            <div v-else-if="gameState.room.phase === 'team_voting' && gameState.isTeammate && needTeamVote" class="phase-content">
              <div class="vote-panel">
                <div class="vote-title">队内投票</div>
                <p style="text-align: center; margin-bottom: 1rem; font-family: var(--typewriter); font-size: 0.9rem;">
                  队友意见不一致，请统一决定
                </p>
                <div class="vote-options">
                  <div 
                    v-for="(option, index) in voteOptions" 
                    :key="index"
                    class="vote-option"
                    :class="{ selected: selectedVote === index }"
                    @click="selectVoteOption(index)"
                  >
                    <div class="clue-index">{{ index + 1 }}</div>
                    <div>{{ option.playerName }}: {{ option.guess.join(' - ') }}</div>
                  </div>
                  <!-- 自由输入选项 -->
                  <div 
                    class="vote-option custom-option"
                    :class="{ selected: selectedVote === voteOptions.length }"
                    @click="selectedVote = voteOptions.length"
                  >
                    <div class="clue-index">✎</div>
                    <div>自定义密码</div>
                  </div>
                </div>
                <!-- 自定义密码输入 -->
                <div v-if="selectedVote === voteOptions.length" class="custom-code-input" style="margin-top: 1rem;">
                  <div class="code-inputs">
                    <input 
                      v-for="i in 3" 
                      :key="'custom-' + i"
                      type="number" 
                      class="code-input" 
                      v-model="customVoteGuess[i - 1]"
                      min="1" 
                      max="4" 
                      placeholder="?"
                    />
                  </div>
                </div>
                <button class="btn btn-primary" @click="onTeamVoteSubmit" style="width: 100%; margin-top: 1rem;">
                  确认统一密码
                </button>
              </div>
            </div>

            <!-- 等待中 -->
            <div v-else class="phase-content">
              <div class="phase-title">等待中...</div>
              <p style="text-align: center; font-family: var(--typewriter);">
                各方正在解码...
              </p>
              <div class="clue-display">
                <div 
                  v-for="(clue, index) in gameState.room.clues" 
                  :key="index"
                  class="clue-item"
                >
                  <div class="clue-index">{{ index + 1 }}</div>
                  <div class="clue-text">{{ clue }}</div>
                </div>
              </div>
              <p v-if="gameState.isEncryptor" style="text-align: center; margin-top: 1rem; font-family: var(--typewriter);">
                密码: {{ gameState.room.currentCode.join(' - ') }}
              </p>
            </div>
          </template>

          <!-- 结果阶段 -->
          <template v-else-if="gameState.room.phase === 'result'">
            <div class="phase-content">
              <div class="phase-title">战报</div>
              <div style="text-align: center; margin: 1.5rem 0;">
                <p style="font-size: 1.1rem; line-height: 1.8; font-family: var(--serif);" v-html="gameState.room.roundResult?.message"></p>
              </div>
              <div style="background: rgba(0,0,0,0.05); border: 2px solid var(--telegram-border); padding: 1rem; margin-bottom: 1rem;">
                <p style="font-family: var(--typewriter);"><strong>正确密码:</strong> {{ gameState.room.roundResult?.correctCode?.join(' - ') }}</p>
                <p v-if="gameState.room.roundResult?.teammateGuess" style="font-family: var(--typewriter);">
                  <strong>{{ isOurTeamEncrypting ? '我方解码' : '我方拦截' }}:</strong> 
                  {{ gameState.room.roundResult?.teammateGuess?.join(' - ') }}
                </p>
              </div>
              <div class="clue-display">
                <div 
                  v-for="(clue, index) in gameState.room.clues" 
                  :key="index"
                  class="clue-item"
                >
                  <div class="clue-index">{{ index + 1 }}</div>
                  <div class="clue-text">{{ clue }}</div>
                  <div style="margin-left: auto; font-family: var(--typewriter); color: var(--ink-blue);">
                    → {{ gameState.room.roundResult?.correctCode?.[index] }}
                  </div>
                </div>
              </div>
              <button 
                v-if="gameState.isHost || gameState.room.status === GAME_PHASES.ENDED" 
                class="btn btn-primary" 
                @click="onNextRoundClick" 
                style="width: 100%; margin-top: 1.5rem;"
              >
                {{ gameState.room.status === GAME_PHASES.ENDED ? '新的任务' : '下一回合' }}
              </button>
            </div>
          </template>
        </div>

        <!-- 敌方关键词 -->
        <div class="screen-panel">
          <div class="screen-title">{{ enemyTeamLabel }} 密码本</div>
          <div class="keywords-grid">
            <div 
              v-for="(word, index) in enemyKeywords" 
              :key="index"
              class="keyword-card visible enemy"
            >
              <div class="keyword-number">{{ index + 1 }}</div>
              <div class="keyword-word">{{ word }}</div>
            </div>
          </div>
        </div>

        <!-- 笔记区域 -->
        <div class="note-sheet">
          <div class="note-section">
            <div class="note-title">我方情报记录</div>
            <div v-if="ourNotes.length === 0" style="color: rgba(0,0,0,0.3); font-style: italic; font-family: var(--typewriter);">
              暂无记录
            </div>
            <div 
              v-for="(note, index) in ourNotes" 
              :key="'our-' + index"
              class="note-round"
            >
              <strong>第{{ note.round }}回合:</strong> 
              <div class="note-clues">
                <span v-for="(clue, ci) in note.clues" :key="ci" class="note-clue-item">
                  <span class="note-clue-num">{{ ci + 1 }}</span>{{ clue }}
                </span>
              </div>
              <span v-if="note.code" class="note-code"> → {{ note.code.join('-') }}</span>
              <span class="note-result" :class="{ success: note.success, fail: !note.success }">
                {{ note.success ? '✓' : '✗' }}
              </span>
            </div>
          </div>
          <div class="note-section">
            <div class="note-title">敌方情报记录</div>
            <div v-if="enemyNotes.length === 0" style="color: rgba(0,0,0,0.3); font-style: italic; font-family: var(--typewriter);">
              暂无记录
            </div>
            <div 
              v-for="(note, index) in enemyNotes" 
              :key="'enemy-' + index"
              class="note-round"
            >
              <strong>第{{ note.round }}回合:</strong> 
              <div class="note-clues">
                <span v-for="(clue, ci) in note.clues" :key="ci" class="note-clue-item">
                  <span class="note-clue-num">{{ ci + 1 }}</span>
                  <span 
                    class="note-clue-text" 
                    :class="{ 'keyword-highlight': isEnemyKeyword(clue) }"
                  >{{ clue }}</span>
                </span>
              </div>
              <span class="note-result" :class="{ success: note.success, fail: !note.success }">
                {{ note.success ? '拦截✓' : '拦截✗' }}
              </span>
            </div>
          </div>
          <!-- 关键词标记面板 -->
          <div class="note-section keyword-panel">
            <div class="note-title">敌方密码推理</div>
            <div class="keyword-mark-grid">
              <div 
                v-for="(word, index) in enemyKeywords" 
                :key="'km-' + index"
                class="keyword-mark-item"
              >
                <span class="keyword-mark-num">{{ index + 1 }}</span>
                <span class="keyword-mark-word">{{ word }}</span>
                <span class="keyword-mark-notes">
                  <input 
                    type="text" 
                    class="keyword-mark-input"
                    v-model="keywordNotes[index]"
                    placeholder="推理笔记..."
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { gameState, handleSubmitClues, handleSubmitTeamGuess, handleSubmitOpponentGuess, handleSubmitOpponentVote, handleSubmitTeamVote, handleNextRound, handlePlayAgain, reconnectRoom, GAME_PHASES } from '../stores/gameStore';
import { showToast } from './ToastNotification.vue';
import { sanitizeClues } from '../services/sanitize';

const clues = ref(['', '', '']);
const teammateGuess = ref(['', '', '']);
const opponentGuess = ref(['', '', '']);
const selectedVote = ref(null);
const customVoteGuess = ref(['', '', '']);
const selectedOpponentVote = ref(null);
const customOpponentVoteGuess = ref(['', '', '']);
const keywordNotes = ref(['', '', '', '']);
const isReconnecting = ref(false);

const whiteInterceptTokens = computed(() => gameState.room.teams?.white?.interceptionTokens || 0);
const whiteMiscommunicationTokens = computed(() => gameState.room.teams?.white?.miscommunicationTokens || 0);
const blackInterceptTokens = computed(() => gameState.room.teams?.black?.interceptionTokens || 0);
const blackMiscommunicationTokens = computed(() => gameState.room.teams?.black?.miscommunicationTokens || 0);

const connectionStatus = computed(() => gameState.connectionStatus);
const connectionMessage = computed(() => gameState.connectionMessage);

const isOnline = computed(() => {
  const player = gameState.room.players.find(p => p.id === gameState.playerId);
  return player?.isOnline !== false;
});

const isPaused = computed(() => gameState.room.phase === GAME_PHASES.PAUSED);

const allPlayers = computed(() => gameState.room.players || []);

const onlinePlayers = computed(() => {
  return gameState.room.players?.filter(p => p.isOnline) || [];
});

const disconnectedPlayers = computed(() => {
  return gameState.room.players?.filter(p => !p.isOnline) || [];
});

const onlinePlayerCount = computed(() => {
  return onlinePlayers.value.length;
});

const isOurTeamEncrypting = computed(() => {
  return gameState.team === gameState.room.encryptorTeam;
});

const ourKeywords = computed(() => {
  return gameState.team === 'white' 
    ? gameState.room.whiteKeywords 
    : gameState.room.blackKeywords;
});

const enemyKeywords = computed(() => {
  return gameState.team === 'white' 
    ? gameState.room.blackKeywords 
    : gameState.room.whiteKeywords;
});

const ourTeamLabel = computed(() => {
  return gameState.team === 'white' ? '白队' : '黑队';
});

const enemyTeamLabel = computed(() => {
  return gameState.team === 'white' ? '黑队' : '白队';
});

const encryptorName = computed(() => {
  const encryptor = gameState.room.players.find(p => p.id === gameState.room.encryptor);
  return encryptor?.name || '情报官';
});

const currentEncryptorInfo = computed(() => {
  const encryptor = gameState.room.players.find(p => p.id === gameState.room.encryptor);
  if (!encryptor) return null;
  return {
    name: encryptor.name,
    team: gameState.room.encryptorTeam,
    teamName: gameState.room.encryptorTeam === 'white' ? '白队' : '黑队'
  };
});

const rotationOrder = computed(() => {
  const order = ['黑A', '白A', '黑B', '白B'];
  return order[gameState.room.rotationIndex || 0];
});

const ourNotes = computed(() => {
  const team = gameState.team || 'white';
  return gameState.room.notes?.[team] || [];
});

const enemyNotes = computed(() => {
  const enemyTeam = gameState.team === 'white' ? 'black' : 'white';
  return gameState.room.notes?.[enemyTeam] || [];
});

// 检查是否已提交队友猜测
const hasSubmittedTeamGuess = computed(() => {
  if (!gameState.team) return false;
  const teamVotes = gameState.room.teamVotes?.[gameState.team];
  if (!teamVotes) return false;
  
  const teamPlayers = gameState.room.teams?.[gameState.team]?.players || [];
  const playerIndex = teamPlayers.indexOf(gameState.playerId);
  if (playerIndex === -1) return false;
  
  const voteKey = playerIndex === 0 ? 'player1Guess' : 'player2Guess';
  return teamVotes[voteKey] !== null;
});

// 检查是否已提交对方拦截
const hasSubmittedOpponentGuess = computed(() => {
  if (!gameState.team) return false;
  const opponentVotes = gameState.room.opponentVotes;
  if (!opponentVotes) return false;
  
  const interceptTeam = gameState.room.encryptorTeam === 'white' ? 'black' : 'white';
  if (gameState.team !== interceptTeam) return false;
  
  const teamPlayers = gameState.room.teams?.[interceptTeam]?.players || [];
  const playerIndex = teamPlayers.indexOf(gameState.playerId);
  if (playerIndex === -1) return false;
  
  const voteKey = playerIndex === 0 ? 'player1Guess' : 'player2Guess';
  return opponentVotes[voteKey] !== null;
});

// 检查拦截方是否需要投票
const needOpponentVote = computed(() => {
  const opponentVotes = gameState.room.opponentVotes;
  if (!opponentVotes) return false;
  
  const interceptTeam = gameState.room.encryptorTeam === 'white' ? 'black' : 'white';
  if (gameState.team !== interceptTeam) return false;
  
  return opponentVotes.player1Guess !== null && 
         opponentVotes.player2Guess !== null && 
         opponentVotes.finalGuess === null;
});

// 拦截方投票选项
const opponentVoteOptions = computed(() => {
  const opponentVotes = gameState.room.opponentVotes;
  if (!opponentVotes) return [];
  
  const interceptTeam = gameState.room.encryptorTeam === 'white' ? 'black' : 'white';
  const teamPlayers = gameState.room.teams?.[interceptTeam]?.players || [];
  const options = [];
  
  if (opponentVotes.player1Guess) {
    const player = gameState.room.players.find(p => p.id === teamPlayers[0]);
    options.push({
      playerName: player?.name || '队友1',
      guess: opponentVotes.player1Guess
    });
  }
  
  if (opponentVotes.player2Guess) {
    const player = gameState.room.players.find(p => p.id === teamPlayers[1]);
    options.push({
      playerName: player?.name || '队友2',
      guess: opponentVotes.player2Guess
    });
  }
  
  return options;
});

// 检查是否需要队内投票
const needTeamVote = computed(() => {
  if (!gameState.team) return false;
  const teamVotes = gameState.room.teamVotes?.[gameState.team];
  if (!teamVotes) return false;
  
  return teamVotes.player1Guess !== null && 
         teamVotes.player2Guess !== null && 
         teamVotes.finalGuess === null;
});

// 投票选项
const voteOptions = computed(() => {
  if (!gameState.team) return [];
  const teamVotes = gameState.room.teamVotes?.[gameState.team];
  if (!teamVotes) return [];
  
  const teamPlayers = gameState.room.teams?.[gameState.team]?.players || [];
  const options = [];
  
  if (teamVotes.player1Guess) {
    const player = gameState.room.players.find(p => p.id === teamPlayers[0]);
    options.push({
      playerName: player?.name || '队友1',
      guess: teamVotes.player1Guess
    });
  }
  
  if (teamVotes.player2Guess) {
    const player = gameState.room.players.find(p => p.id === teamPlayers[1]);
    options.push({
      playerName: player?.name || '队友2',
      guess: teamVotes.player2Guess
    });
  }
  
  return options;
});

async function handleReconnect() {
  isReconnecting.value = true;
  try {
    await reconnectRoom();
  } finally {
    isReconnecting.value = false;
  }
}

async function onCluesSubmit() {
  const { value: validClues, error } = sanitizeClues(clues.value);
  if (error) {
    showToast(error, 'warning');
    return;
  }
  if (validClues.length !== 3) {
    showToast('请输入所有 3 个线索！', 'warning');
    return;
  }
  
  const success = await handleSubmitClues(validClues);
  if (success) {
    clues.value = ['', '', ''];
  }
}

async function onTeammateGuessSubmit() {
  const validGuess = teammateGuess.value.map(g => parseInt(g));
  if (validGuess.some(g => isNaN(g) || g < 1 || g > 4)) {
    showToast('请输入有效的数字（1-4）！', 'warning');
    return;
  }
  
  await handleSubmitTeamGuess(validGuess);
  teammateGuess.value = ['', '', ''];
}

async function onOpponentGuessSubmit() {
  const validGuess = opponentGuess.value.map(g => parseInt(g));
  if (validGuess.some(g => isNaN(g) || g < 1 || g > 4)) {
    showToast('请输入有效的数字（1-4）！', 'warning');
    return;
  }
  
  await handleSubmitOpponentGuess(validGuess);
  opponentGuess.value = ['', '', ''];
}

function selectOpponentVoteOption(index) {
  selectedOpponentVote.value = index;
  if (index < opponentVoteOptions.value.length) {
    customOpponentVoteGuess.value = ['', '', ''];
  }
}

async function onOpponentVoteSubmit() {
  if (selectedOpponentVote.value === null) {
    showToast('请选择一个密码！', 'warning');
    return;
  }
  
  let guessToSubmit;
  
  if (selectedOpponentVote.value === opponentVoteOptions.value.length) {
    guessToSubmit = customOpponentVoteGuess.value.map(g => parseInt(g));
    if (guessToSubmit.some(g => isNaN(g) || g < 1 || g > 4)) {
      showToast('请输入有效的数字（1-4）！', 'warning');
      return;
    }
  } else {
    const selectedOption = opponentVoteOptions.value[selectedOpponentVote.value];
    if (!selectedOption) {
      showToast('选择无效！', 'error');
      return;
    }
    guessToSubmit = selectedOption.guess;
  }
  
  await handleSubmitOpponentVote(guessToSubmit);
  selectedOpponentVote.value = null;
  customOpponentVoteGuess.value = ['', '', ''];
}

// 检查线索文本是否与敌方关键词相关（高亮标记用）
function isEnemyKeyword(clue) {
  if (!enemyKeywords.value) return false;
  return enemyKeywords.value.some(kw => clue.includes(kw) || kw.includes(clue));
}

function selectVoteOption(index) {
  selectedVote.value = index;
  // 选择已有选项时清除自定义输入
  if (index < voteOptions.value.length) {
    customVoteGuess.value = ['', '', ''];
  }
}

async function onTeamVoteSubmit() {
  if (selectedVote.value === null) {
    showToast('请选择一个密码！', 'warning');
    return;
  }
  
  let guessToSubmit;
  
  if (selectedVote.value === voteOptions.value.length) {
    // 自定义输入
    guessToSubmit = customVoteGuess.value.map(g => parseInt(g));
    if (guessToSubmit.some(g => isNaN(g) || g < 1 || g > 4)) {
      showToast('请输入有效的数字（1-4）！', 'warning');
      return;
    }
  } else {
    const selectedOption = voteOptions.value[selectedVote.value];
    if (!selectedOption) {
      showToast('选择无效！', 'error');
      return;
    }
    guessToSubmit = selectedOption.guess;
  }
  
  await handleSubmitTeamVote(guessToSubmit);
  selectedVote.value = null;
  customVoteGuess.value = ['', '', ''];
}

async function onNextRoundClick() {
  if (gameState.room.status === GAME_PHASES.ENDED) {
    handlePlayAgain();
  } else {
    handleNextRound();
  }
}
</script>

<style scoped>
.connection-status {
  padding: 0.8rem;
  margin-bottom: 1rem;
  text-align: center;
  font-family: var(--typewriter);
  font-size: 0.85rem;
  border: 2px solid;
}

.connection-status.connecting {
  background: rgba(46, 74, 98, 0.1);
  border-color: var(--ink-blue);
  color: var(--ink-blue);
}

.connection-status.connected {
  background: rgba(61, 92, 58, 0.1);
  border-color: var(--ink-green);
  color: var(--ink-green);
}

.connection-status.error {
  background: rgba(139, 38, 53, 0.1);
  border-color: var(--ink-red);
  color: var(--ink-red);
}

.connection-status.reconnecting {
  background: rgba(107, 68, 35, 0.1);
  border-color: var(--ink-brown);
  color: var(--ink-brown);
  animation: blink 1.5s ease-in-out infinite;
}

.disconnect-alert, .pause-alert {
  background: var(--paper-bg);
  border: 3px solid var(--ink-red);
  padding: 2rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.disconnect-title, .pause-title {
  font-family: var(--typewriter);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink-red);
  margin-bottom: 1rem;
  letter-spacing: 0.1em;
}

.disconnect-message, .pause-message {
  font-family: var(--typewriter);
  color: var(--ink-brown);
  margin-bottom: 1.5rem;
}

.disconnected-players, .online-players {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.03);
}

.disconnected-player, .online-player {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.3rem;
}

.player-name {
  font-family: var(--typewriter);
  font-size: 0.9rem;
}

.offline-badge {
  background: var(--ink-red);
  color: var(--paper-bg);
  padding: 0.1rem 0.4rem;
  font-family: var(--typewriter);
  font-size: 0.6rem;
  text-transform: uppercase;
}

.online-badge {
  background: var(--ink-green);
  color: var(--paper-bg);
  padding: 0.1rem 0.4rem;
  font-family: var(--typewriter);
  font-size: 0.6rem;
  text-transform: uppercase;
}

.online-players-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1.2rem;
  background: var(--paper-bg);
  border: 2px solid var(--telegram-border);
  margin-bottom: 1.5rem;
}

.online-count {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
}

.count-number {
  font-family: var(--typewriter);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink-black);
}

.count-total {
  font-family: var(--typewriter);
  font-size: 0.9rem;
  color: var(--ink-brown);
}

.player-avatars {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.player-avatar {
  width: 36px;
  height: 36px;
  border: 2px solid var(--telegram-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--paper-bg);
}

.player-avatar.online {
  border-color: var(--ink-green);
}

.player-avatar.offline {
  border-color: var(--ink-red);
  opacity: 0.6;
}

.player-avatar.you {
  border-width: 3px;
}

.avatar-name {
  font-family: var(--typewriter);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-black);
}

.avatar-status {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ink-red);
  border: 2px solid var(--paper-bg);
}

.player-avatar.online .avatar-status {
  background: var(--ink-green);
}
</style>