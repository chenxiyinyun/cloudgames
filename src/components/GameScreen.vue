<template>
  <div class="screen active">
    <div class="game-container">
      <div class="game-header">
        <div class="team-info white">
          <div class="team-name">⚪ 白队</div>
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
              :class="{ 'earned': whiteMissTokens >= i }"
            ></div>
          </div>
        </div>
        <div class="round-info">
          <div class="round-number">第 <span>{{ gameState.room.currentRound }}</span> 回合</div>
        </div>
        <div class="team-info black">
          <div class="team-name">⚫ 黑队</div>
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
              :class="{ 'earned': blackMissTokens >= i }"
            ></div>
          </div>
        </div>
      </div>

      <div class="game-area">
        <div class="screen-panel our-team">
          <div class="screen-title">{{ ourTeamLabel }} 的密码词</div>
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

        <div class="phase-panel">
          <template v-if="gameState.room.phase === 'encrypting'">
            <div v-if="gameState.isEncryptor" class="phase-content">
              <div class="phase-title">🎯 你是情报官！</div>
              <p style="text-align: center; margin-bottom: 1rem;">请查看密码并给出 3 个线索</p>
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
                    :placeholder="`输入第 ${i} 个线索...`"
                  />
                </div>
              </div>
              <p class="rules-text">
                <strong>规则：</strong>线索不能包含关键词，不能用拼音、谐音、字数等暗示！
              </p>
              <button class="btn btn-primary" @click="onCluesSubmit" style="width: 100%;">
                提交线索
              </button>
            </div>
            <div v-else-if="gameState.isTeammate" class="phase-content">
              <div class="phase-title">⏳ 等待情报官...</div>
              <p style="text-align: center;">{{ encryptorName }} 正在思考线索...</p>
            </div>
            <div v-else-if="gameState.isOpponent" class="phase-content">
              <div class="phase-title">👂 敌方正在加密...</div>
              <p style="text-align: center;">准备好拦截他们的密码！</p>
            </div>
          </template>

          <template v-else-if="gameState.room.phase === 'guessing'">
            <div v-if="gameState.isTeammate && !gameState.hasTeammateGuess" class="phase-content">
              <div class="phase-title">🤔 猜密码！</div>
              <p style="text-align: center; margin-bottom: 1rem;">根据线索猜出密码</p>
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
                提交猜测
              </button>
            </div>
            <div v-else-if="gameState.isOpponent && !gameState.hasOpponentGuess" class="phase-content">
              <div class="phase-title">🕵️ 拦截密码！</div>
              <p style="text-align: center; margin-bottom: 1rem;">尝试猜出敌方的密码</p>
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
                尝试拦截
              </button>
            </div>
            <div v-else class="phase-content">
              <div class="phase-title">👀 等待猜测...</div>
              <p style="text-align: center;">两队正在猜密码...</p>
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
              <p v-if="gameState.isEncryptor" style="text-align: center; margin-top: 1rem; font-family: Orbitron;">
                密码: {{ gameState.room.currentCode.join(' - ') }}
              </p>
            </div>
          </template>

          <template v-else-if="gameState.room.phase === 'result'">
            <div class="phase-content">
              <div class="phase-title">📊 本回合结果</div>
              <div style="text-align: center; margin: 1.5rem 0;">
                <p style="font-size: 1.1rem; line-height: 1.8;" v-html="gameState.room.roundResult?.message"></p>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <p><strong>正确密码:</strong> {{ gameState.room.roundResult?.correctCode?.join(' - ') }}</p>
                <p v-if="gameState.room.roundResult?.teammateGuess">
                  <strong>{{ isOurTeamEncrypting ? '我们的猜测' : '我们的拦截' }}:</strong> 
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
                  <div style="margin-left: auto; color: var(--accent);">
                    → {{ gameState.room.roundResult?.correctCode?.[index] }}
                  </div>
                </div>
              </div>
              <button 
                v-if="gameState.isHost || gameState.room.status === 'ended'" 
                class="btn btn-primary" 
                @click="onNextRoundClick" 
                style="width: 100%; margin-top: 1.5rem;"
              >
                {{ gameState.room.status === 'ended' ? '再来一局' : '下一回合' }}
              </button>
            </div>
          </template>
        </div>

        <div class="screen-panel">
          <div class="screen-title">{{ enemyTeamLabel }} 的密码词</div>
          <div class="keywords-grid">
            <div 
              v-for="(word, index) in enemyKeywords" 
              :key="index"
              class="keyword-card"
            >
              <div class="keyword-number">{{ index + 1 }}</div>
              <div class="keyword-word hidden">???</div>
            </div>
          </div>
        </div>

        <div class="note-sheet">
          <div class="note-section">
            <div class="note-title">📝 我们的线索记录</div>
            <div v-if="ourNotes.length === 0" style="color: rgba(255,255,255,0.3); font-style: italic;">
              暂无记录
            </div>
            <div 
              v-for="(note, index) in ourNotes" 
              :key="index"
              class="note-round"
            >
              <strong>第{{ note.round }}回合:</strong> {{ note.clues.join(' / ') }}
              <span v-if="note.code"> → {{ note.code.join('-') }}</span>
            </div>
          </div>
          <div class="note-section">
            <div class="note-title">📝 敌方的线索记录</div>
            <div v-if="enemyNotes.length === 0" style="color: rgba(255,255,255,0.3); font-style: italic;">
              暂无记录
            </div>
            <div 
              v-for="(note, index) in enemyNotes" 
              :key="index"
              class="note-round"
            >
              <strong>第{{ note.round }}回合:</strong> {{ note.clues.join(' / ') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { gameState, handleSubmitClues, handleSubmitGuess, handleNextRound, handlePlayAgain, GUESS_TYPE, GAME_PHASES } from '../stores/gameStore';

const clues = ref(['', '', '']);
const teammateGuess = ref(['', '', '']);
const opponentGuess = ref(['', '', '']);

const whiteInterceptTokens = computed(() => gameState.room.teams?.white?.interceptTokens || 0);
const whiteMissTokens = computed(() => gameState.room.teams?.white?.missTokens || 0);
const blackInterceptTokens = computed(() => gameState.room.teams?.black?.interceptTokens || 0);
const blackMissTokens = computed(() => gameState.room.teams?.black?.missTokens || 0);

const hasTeammateGuess = computed(() => gameState.room.teammateGuess !== null);
const hasOpponentGuess = computed(() => gameState.room.opponentGuess !== null);

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
  return gameState.team === 'white' ? '⚪ 白队' : '⚫ 黑队';
});

const enemyTeamLabel = computed(() => {
  return gameState.team === 'white' ? '⚫ 黑队' : '⚪ 白队';
});

const encryptorName = computed(() => {
  const encryptor = gameState.room.players.find(p => p.id === gameState.room.encryptor);
  return encryptor?.name || '情报官';
});

const ourNotes = computed(() => {
  const team = gameState.team || 'white';
  return gameState.room.notes?.[team] || [];
});

const enemyNotes = computed(() => {
  const enemyTeam = gameState.team === 'white' ? 'black' : 'white';
  return gameState.room.notes?.[enemyTeam] || [];
});

async function onCluesSubmit() {
  const validClues = clues.value.map(c => c.trim());
  if (validClues.some(c => !c)) {
    alert('请输入所有 3 个线索！');
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
    alert('请输入有效的数字（1-4）！');
    return;
  }
  
  await handleSubmitGuess(GUESS_TYPE.TEAMMATE, validGuess);
  teammateGuess.value = ['', '', ''];
}

async function onOpponentGuessSubmit() {
  const validGuess = opponentGuess.value.map(g => parseInt(g));
  if (validGuess.some(g => isNaN(g) || g < 1 || g > 4)) {
    alert('请输入有效的数字（1-4）！');
    return;
  }
  
  await handleSubmitGuess(GUESS_TYPE.OPPONENT, validGuess);
  opponentGuess.value = ['', '', ''];
}

async function onNextRoundClick() {
  if (gameState.room.status === GAME_PHASES.ENDED) {
    handlePlayAgain();
  } else {
    handleNextRound();
  }
}
</script>
