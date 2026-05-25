<template>
  <div class="screen active">
    <div class="card">
      <div class="telegram-header" style="margin-bottom: 1.5rem;">
        <div class="telegram-icon">T</div>
        <div>
          <div style="font-family: var(--typewriter); font-size: 1rem; font-weight: 700;">TELEGRAPH</div>
          <div class="morse-decoration">- . .-.. . --. .-. .- .--.</div>
        </div>
        <div class="telegram-icon">M</div>
      </div>
      
      <h1>截码战</h1>
      <p class="subtitle">CODENAMES</p>
      
      <div class="morse-decoration" style="margin-bottom: 2rem;">
        -.-. --- -.. . -. .- -- . ...
      </div>

      <div class="input-group">
        <label>特工代号</label>
        <input 
          type="text" 
          v-model="playerName" 
          placeholder="输入你的代号"
          @keyup.enter="handleCreate"
        />
      </div>

      <button class="btn btn-primary" @click="handleCreate" style="width: 100%; margin-bottom: 1rem;">
        创建任务
      </button>

      <div class="divider"><span>或</span></div>

      <div class="input-group">
        <label>任务编号</label>
        <input 
          type="text" 
          v-model="roomCode" 
          placeholder="输入任务编号"
          @keyup.enter="handleJoin"
        />
      </div>

      <button class="btn btn-secondary" @click="handleJoin" style="width: 100%;">
        加入任务
      </button>
      
      <div class="morse-decoration" style="margin-top: 1.5rem;">
        .-- .- .-. / .. ... / .... . .-.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { createRoom, joinRoom } from '../stores/gameStore';

const playerName = ref('');
const roomCode = ref('');

async function handleCreate() {
  if (!playerName.value.trim()) {
    alert('请输入你的代号');
    return;
  }
  await createRoom(playerName.value.trim());
}

async function handleJoin() {
  if (!playerName.value.trim()) {
    alert('请输入你的代号');
    return;
  }
  if (!roomCode.value.trim()) {
    alert('请输入任务编号');
    return;
  }
  await joinRoom(playerName.value.trim(), roomCode.value.trim().toUpperCase());
}
</script>