/* 启动与交互 */
(function () {
  const SH = window.SH;
  const U = SH.util;
  const ui = SH.ui;

  const app = document.getElementById('app');

  function isFresh(state) {
    return (
      !state.letters.length &&
      !Object.keys(state.trips).length &&
      SH.BEASTS.every((b) => !state.beasts[b.id].travels)
    );
  }

  function afterReturn(results) {
    const done = (results || []).filter((r) => r && r.letters && r.letters.length);
    if (!done.length) return false;

    const names = done.map((r) => r.letters[0].beastName).join('、');
    const gained = done.reduce((n, r) => n + r.gained.length, 0);
    const sou = gained ? `，带回 ${gained} 件纪念品` : '';

    // 只有正在庭院时才自动翻到信箱；玩家在看书/摆件时不被强行打断
    let switched = false;
    if (ui.view.tab === 'yard') {
      const all = done.reduce((arr, r) => arr.concat(r.letters), []);
      // 优先打开可以回信的那封；没有的话再退回最新一封（阶段信通常没有回信选项）
      const first = all.find((l) => l.reply && l.replied == null) || all.find((l) => !l.stage) || all[0];
      ui.view.tab = 'mailbox';
      ui.view.prevTab = 'yard';
      ui.view.openLetter = first ? first.id : null;
      ui.toast(`${names} 回来了${sou}`, 'return');
      switched = true;
    } else {
      ui.toast(`${names} 回来了${sou}，信已放进信箱`, 'return');
    }
    return switched;
  }

  /* ---------- 交互分发 ---------- */
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const state = SH.state;
    const v = ui.view;

    switch (act) {
      case 'tab':
        if (v.tab !== el.dataset.tab) {
          v.openLetter = null;
          v.placingSlot = null;
        }
        v.tab = el.dataset.tab;
        ui.render();
        window.scrollTo({ top: 0, behavior: 'auto' });
        break;

      case 'goto-prepare':
        v.tab = 'prepare';
        v.prepBeast = el.dataset.beast;
        v.openLetter = null;
        v.placingSlot = null;
        ui.render();
        window.scrollTo({ top: 0, behavior: 'auto' });
        break;

      case 'pick-beast':
        if (state.trips[el.dataset.beast]) return ui.toast('它还在路上', 'warn');
        v.prepBeast = v.prepBeast === el.dataset.beast ? null : el.dataset.beast;
        ui.render();
        break;

      case 'pick-pref':
        v.prepPref = el.dataset.pref;
        ui.render();
        break;

      case 'pick-item': {
        const id = el.dataset.item;
        if (!(state.inventory[id] > 0)) return ui.toast('这件已经没有了', 'warn');
        const i = v.prepItems.indexOf(id);
        if (i >= 0) v.prepItems.splice(i, 1);
        else if (v.prepItems.length >= 3) return ui.toast('最多带 3 件', 'warn');
        else v.prepItems.push(id);
        ui.render();
        break;
      }

      case 'depart': {
        if (!v.prepBeast) return ui.toast('先选一只神兽', 'warn');
        const res = SH.sys.startTrip(state, v.prepBeast, v.prepPref, v.prepItems.slice());
        if (!res.ok) return ui.toast(res.msg);
        const name = SH.sys.beastById(v.prepBeast).name;
        v.prepItems = [];
        v.prepBeast = null;
        v.tab = 'yard';
        ui.render();
        window.scrollTo({ top: 0, behavior: 'auto' });
        ui.toast(`${name} 出发了。路上会给你写信。`);
        break;
      }

      case 'force': {
        const left = SH.sys.hourglassLeft(state);
        if (!left) {
          ui.toast('今天的静心沙漏用完了，明天再来', 'warn');
          return;
        }
        const r = SH.sys.forceReturn(state, el.dataset.beast);
        if (r && r.limited) return ui.toast('今天的静心沙漏用完了，明天再来', 'warn');
        const switched = afterReturn([r]);
        ui.render();
        if (switched) window.scrollTo({ top: 0, behavior: 'auto' });
        break;
      }

      case 'open-letter': {
        const opening = v.openLetter !== el.dataset.letter;
        v.openLetter = opening ? el.dataset.letter : null;
        ui.render();
        if (opening) {
          const env = document.querySelector('.env.open');
          if (env) env.scrollIntoView({ block: 'start' });
        }
        break;
      }

      case 'reply': {
        const letter = state.letters.find((l) => l.id === el.dataset.letter);
        const r = SH.sys.replyLetter(state, el.dataset.letter, Number(el.dataset.idx));
        ui.render();
        if (r) {
          ui.toast(letter && letter.visitor ? '回信已收好。驿站记住了这句话。' : '信已寄出。它会记住这句话。');
          const head = document.querySelector('.env.open .env-head');
          if (head) head.focus({ preventScroll: true });
        }
        break;
      }

      case 'slot': {
        v.placingSlot = Number(el.dataset.slot);
        ui.render();
        const picker = document.querySelector('.picker');
        if (picker) picker.scrollIntoView({ block: 'nearest' });
        break;
      }

      case 'place': {
        const slot = v.placingSlot;
        const r = SH.sys.placeSouvenir(state, slot, el.dataset.sou);
        if (!r.ok) return ui.toast(r.msg || '摆不下了');
        v.placingSlot = null;
        ui.render();
        const target = document.querySelector(`[data-act="slot"][data-slot="${slot}"]`);
        if (target) target.focus({ preventScroll: true });
        if (r.unlocked && r.unlocked.length) {
          const names = r.unlocked.map((u) => u.name).join('、');
          ui.toast(`有人找上门来：${names}。它寄来了一封信。`, 'return');
        } else {
          ui.toast(r.movedFrom == null ? '摆好了' : '挪到新位置了');
        }
        break;
      }

      case 'clear-slot': {
        const slot = v.placingSlot;
        SH.sys.placeSouvenir(state, slot, null);
        v.placingSlot = null;
        ui.render();
        const target = document.querySelector(`[data-act="slot"][data-slot="${slot}"]`);
        if (target) target.focus({ preventScroll: true });
        break;
      }

      case 'close-picker': {
        const slot = v.placingSlot;
        v.placingSlot = null;
        ui.render();
        const target = document.querySelector(`[data-act="slot"][data-slot="${slot}"]`);
        if (target) target.focus({ preventScroll: true });
        break;
      }

      case 'supply': {
        const r = SH.sys.claimSupply(state);
        if (!r.ok) return ui.toast(`补给还没恢复，还需 ${U.fmtDuration(r.remain)}`, 'warn');
        ui.render();
        ui.toast(`获得 ${r.got.map((i) => i.name).join('、')}`);
        break;
      }

      case 'toggle-drawer':
        v.drawerOpen = !v.drawerOpen;
        ui.render();
        break;

      case 'export': {
        const blob = new Blob([SH.exportSave()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `山海来信-存档-${U.fmtDate(U.now())}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        ui.toast('存档已导出');
        break;
      }

      case 'import': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
          const f = input.files && input.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              SH.importSave(String(reader.result));
              SH.sys.refreshVisitors(SH.state);
              SH.save();
              v.prepBeast = null;
              v.prepItems = [];
              v.openLetter = null;
              v.placingSlot = null;
              ui.render();
              ui.toast('存档已导入');
            } catch (err) {
              ui.toast('导入失败：' + err.message, 'warn');
            }
          };
          reader.readAsText(f);
        };
        input.click();
        break;
      }

      case 'reset':
        if (confirm('确定重置？所有信件、纪念品与记忆都会清空。')) {
          SH.resetSave();
          SH.sys.grantStarterItems(SH.state);
          SH.save();
          v.openLetter = null;
          v.placingSlot = null;
          v.prepBeast = null;
          v.prepItems = [];
          v.prepPref = 'free';
          v.tab = 'yard';
          v.drawerOpen = false;
          ui.render();
          window.scrollTo({ top: 0, behavior: 'auto' });
          ui.toast('已重置，重新出发吧');
        }
        break;
    }
  });

  app.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="fast"]');
    if (!el) return;
    SH.state.settings.fastMode = el.checked;
    SH.save();
    ui.render();
    ui.toast(el.checked ? '快速模式：旅行时间大幅缩短' : '已关闭快速模式');
  });

  /* ---------- 倒计时与旅途进度 ---------- */
  function tickCountdown() {
    const now = U.now();
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const t = Number(el.dataset.return) - now;
      el.textContent = t > 0 ? U.fmtDuration(t) : '正在归来…';
    });
    document.querySelectorAll('[data-progress]').forEach((el) => {
      const depart = Number(el.dataset.depart);
      const ret = Number(el.dataset.return);
      const pct = ret > depart ? Math.max(0, Math.min(100, ((now - depart) / (ret - depart)) * 100)) : 100;
      const bar = el.querySelector('i');
      if (bar) bar.style.width = pct.toFixed(1) + '%';
    });
  }

  /* ---------- 键盘：Escape 收起当前浮层 ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const v = ui.view;
    if (v.placingSlot != null) {
      v.placingSlot = null;
      ui.render();
      return;
    }
    if (v.openLetter) {
      const id = v.openLetter;
      v.openLetter = null;
      ui.render();
      const head = Array.from(document.querySelectorAll('[data-act="open-letter"]'))
        .find((el) => el.dataset.letter === id);
      if (head) head.focus({ preventScroll: true });
      return;
    }
    if (v.drawerOpen) {
      v.drawerOpen = false;
      ui.render();
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    const state = SH.load();
    if (isFresh(state)) {
      SH.sys.grantStarterItems(state);
    }
    if (!state.settings) state.settings = { fastMode: false };
    // 旧存档：等待节奏回归真实时长（快速模式仍可手动打开）
    if (state.settings.fastMode === undefined) state.settings.fastMode = false;
    if (!state.hourglass) state.hourglass = { day: U.fmtDate(U.now()), used: 0 };
    // 导入存档 / 刷新页面后按当前陈设补算访客
    SH.sys.refreshVisitors(state);
    SH.save();

    const done = SH.sys.tick(state);
    afterReturn(done);
    ui.render();
    if (done.length) window.scrollTo({ top: 0, behavior: 'auto' });

    tickCountdown();
    setInterval(tickCountdown, 1000);
    setInterval(() => {
      const d = SH.sys.tick(SH.state);
      if (d.length) {
        const switched = afterReturn(d);
        ui.render();
        if (switched) window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }, 5000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const d = SH.sys.tick(SH.state);
        if (d.length) {
          const switched = afterReturn(d);
          ui.render();
          if (switched) window.scrollTo({ top: 0, behavior: 'auto' });
        }
      }
    });
  }

  boot();
})();
