<template>
  <div class="screen active">
    <div class="card">
      <h1>截码战</h1>
      <p class="subtitle">Codenames</p>

      <div class="input-group">
        <label>你的名字</label>
        <input 
          type="text" 
          v-model="playerName" 
          placeholder="输入你的名字"
          @keyup.enter="handleCreate"
        />
      </div>

      <button class="btn btn-primary" @click="handleCreate" style="width: 100%; margin-bottom: 1rem;">
        创建房间
      </button>

      <div class="divider"><span>或</span></div>

      <div class="input-group">
        <label>房间号</label>
        <input 
          type="text" 
          v-model="roomCode" 
          placeholder="输入房间号"
          @keyup.enter="handleJoin"
        />
      </div>

      <button class="btn btn-secondary" @click="handleJoin" style="width: 100%;">
        加入房间
      </button>
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
    alert('请输入你的名字');
    return;
  }
  await createRoom(playerName.value.trim());
}

async function handleJoin() {
  if (!playerName.value.trim()) {
    alert('请输入你的名字');
    return;
  }
  if (!roomCode.value.trim()) {
    alert('请输入房间号');
    return;
  }
  await joinRoom(playerName.value.trim(), roomCode.value.trim().toUpperCase());
}
</script>
