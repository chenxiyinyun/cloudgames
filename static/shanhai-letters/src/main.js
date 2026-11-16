/* 启动与交互控制 —— 空间物件点击 + 轻声效 + 自动结算 */
(function () {
  const SH = window.SH;
  const U = SH.util;
  const ui = SH.ui;
  const S = () => SH.sound;

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
    const all = done.reduce((arr, r) => arr.concat(r.letters), []);
    const first = all.find((l) => l.reply && l.replied == null) || all.find((l) => !l.stage) || all[0];

    if (S()) S().arrive();

    // 若未打开其他弹匣，自动提示并可一键拆信；若正停留在场景里，弹出温润的归来提示
    if (!ui.view.modal) {
      ui.toast(`${names} 回来了${sou}`, 'return', {
        label: '拆信',
        act: 'toast-open-mail',
        letter: first ? first.id : ''
      });
    } else {
      ui.toast(`${names} 回来了${sou}，信已放进门口信箱`, 'return');
    }
    return true;
  }

  function handleAction(el) {
    const act = el.dataset.act;
    const state = SH.state;
    const v = ui.view;

    switch (act) {
      case 'toggle-scene':
        if (S()) S().tap();
        v.scene = v.scene === 'hall' ? 'yard' : 'hall';
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        v.modal = null;
        ui.render();
        {
          const scroller = document.querySelector('.scene-scroller');
          if (scroller) scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
        }
        break;

      case 'pan': {
        const scroller = document.querySelector('.scene-scroller');
        if (scroller) {
          const dir = Number(el.dataset.dir) || 1;
          scroller.scrollBy({ left: dir * Math.round(scroller.clientWidth * 0.55), behavior: 'smooth' });
        }
        break;
      }

      case 'toggle-sound':
        state.settings.muted = !state.settings.muted;
        SH.save();
        if (!state.settings.muted && S()) S().tap();
        ui.render();
        ui.toast(state.settings.muted ? '已静音' : '已开启木石轻音');
        break;

      case 'tap-beast': {
        const bid = el.dataset.beast;
        const idx = SH.BEASTS.findIndex((b) => b.id === bid);
        if (S()) S().pet(idx);
        SH.sys.petBeast(state, bid);
        v.bubbleVisitor = null;
        if (v.bubbleBeast === bid) {
          v.bubbleSeed += 1;
        } else {
          v.bubbleBeast = bid;
          v.bubbleSeed = Math.floor(Math.random() * 10);
        }
        v.justPetted = bid;
        ui.render();
        clearTimeout(ui._petTimer);
        ui._petTimer = setTimeout(() => {
          if (ui.view.justPetted === bid) {
            ui.view.justPetted = null;
            const node = document.querySelector(`.beast-actor.is-petted`);
            if (node) node.classList.remove('is-petted');
          }
        }, 900);
        break;
      }

      case 'tap-visitor': {
        const vid = el.dataset.visitor;
        if (S()) S().tap();
        v.bubbleBeast = null;
        v.bubbleVisitor = v.bubbleVisitor === vid ? null : vid;
        ui.render();
        break;
      }

      case 'close-bubbles':
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        ui.render();
        break;

      case 'inspect-away': {
        const bid = el.dataset.beast;
        const trip = state.trips[bid];
        if (!trip) return;
        const stop = trip.stops[0];
        const city = stop ? SH.sys.cityById(stop.city) : null;
        if (S()) S().tap();
        ui.toast(`${trip.beastName}正在去往${city ? city.name : '远方'}，还剩 ${U.fmtDuration(trip.returnAt - U.now())}`);
        break;
      }

      case 'open-pack': {
        if (S()) S().paper();
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        if (el.dataset.beast && !state.trips[el.dataset.beast]) {
          v.prepBeast = el.dataset.beast;
        }
        v.modal = 'pack';
        ui.render();
        break;
      }

      case 'open-mail':
      case 'toast-open-mail': {
        if (S()) S().paper();
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        if (el.dataset.letter) v.openLetter = el.dataset.letter;
        v.modal = 'mail';
        ui.render();
        break;
      }

      case 'open-shelf':
        if (S()) S().wood();
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        v.scene = 'hall';
        v.placingSlot = v.placingSlot != null ? v.placingSlot : 0;
        v.modal = 'shelf';
        ui.render();
        break;

      case 'pick-wall-slot':
      case 'select-shelf-slot':
        if (S()) S().wood();
        v.placingSlot = Number(el.dataset.slot);
        v.modal = 'shelf';
        ui.render();
        break;

      case 'open-beast-note':
        if (S()) S().paper();
        v.bubbleBeast = null;
        v.inspectBeast = el.dataset.beast;
        v.modal = 'beast';
        ui.render();
        break;

      case 'open-modal':
        if (S()) S().paper();
        v.bubbleBeast = null;
        v.bubbleVisitor = null;
        v.modal = el.dataset.modal;
        ui.render();
        break;

      case 'close-modal':
        if (S()) S().tap();
        v.modal = null;
        ui.render();
        break;

      case 'codex-tab':
        if (S()) S().paper();
        v.codexTab = el.dataset.tab;
        v.inspectSou = null;
        ui.render();
        break;

      case 'inspect-sou':
        if (S()) S().wood();
        v.inspectSou = v.inspectSou === el.dataset.sou ? null : el.dataset.sou;
        ui.render();
        break;

      case 'pick-beast':
        if (state.trips[el.dataset.beast]) return ui.toast('它还在路上', 'warn');
        if (S()) S().tap();
        v.prepBeast = el.dataset.beast;
        ui.render();
        break;

      case 'pick-pref':
        if (S()) S().wood();
        v.prepPref = el.dataset.pref;
        ui.render();
        break;

      case 'pick-item': {
        const id = el.dataset.item;
        if (!(state.inventory[id] > 0)) return ui.toast('这件用完了，去庭院采点灵草吧', 'warn');
        const i = v.prepItems.indexOf(id);
        if (i >= 0) {
          v.prepItems.splice(i, 1);
          if (S()) S().pack(false);
        } else if (v.prepItems.length >= 3) {
          return ui.toast('包袱最多装 3 件物件', 'warn');
        } else {
          v.prepItems.push(id);
          if (S()) S().pack(true);
        }
        ui.render();
        break;
      }

      case 'unpick-item': {
        const id = el.dataset.item;
        const i = v.prepItems.indexOf(id);
        if (i >= 0) {
          v.prepItems.splice(i, 1);
          if (S()) S().pack(false);
          ui.render();
        }
        break;
      }

      case 'depart': {
        if (!v.prepBeast) return ui.toast('先选一只在家的神兽', 'warn');
        const res = SH.sys.startTrip(state, v.prepBeast, v.prepPref, v.prepItems.slice());
        if (!res.ok) return ui.toast(res.msg, 'warn');
        const bid = v.prepBeast;
        const name = SH.sys.beastById(bid).name;
        if (S()) S().depart();
        v.prepItems = [];
        v.prepBeast = null;
        v.modal = null;
        v.scene = 'hall';
        v.departingBeast = bid;
        ui.render();
        ui.toast(`${name} 背起包袱出门了，路上会给你写信。`);
        clearTimeout(ui._departTimer);
        ui._departTimer = setTimeout(() => {
          ui.view.departingBeast = null;
        }, 700);
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
        afterReturn([r]);
        ui.render();
        break;
      }

      case 'harvest-herbs': {
        const r = SH.sys.claimSupply(state);
        if (!r.ok) {
          if (S()) S().tap();
          return ui.toast(`灵草正在蓄露，还需 ${U.fmtDuration(r.remain)}`, 'warn');
        }
        if (S()) S().herb();
        const names = r.got.map((i) => i.name).join('、');
        v.herbBurst = '+' + r.got.map((i) => i.name).join(' +');
        ui.render();
        ui.toast(`采撷灵草，拾得 ${names}`);
        clearTimeout(ui._herbTimer);
        ui._herbTimer = setTimeout(() => {
          ui.view.herbBurst = null;
          const b = document.querySelector('.herb-burst');
          if (b) b.remove();
        }, 1600);
        break;
      }

      case 'select-letter':
        if (S()) S().paper();
        v.openLetter = el.dataset.letter;
        ui.render();
        break;

      case 'reply': {
        const letter = state.letters.find((l) => l.id === el.dataset.letter);
        const r = SH.sys.replyLetter(state, el.dataset.letter, Number(el.dataset.idx));
        if (r) {
          if (S()) S().paper();
          ui.render();
          ui.toast(letter && letter.visitor ? '回信已收好，驿站记住了这句话。' : '回信已寄出，它会记住这句话。');
        }
        break;
      }

      case 'place': {
        const slot = v.placingSlot != null ? v.placingSlot : 0;
        const r = SH.sys.placeSouvenir(state, slot, el.dataset.sou);
        if (!r.ok) return ui.toast(r.msg || '摆不下了', 'warn');
        if (S()) S().wood();
        ui.render();
        if (r.unlocked && r.unlocked.length) {
          const names = r.unlocked.map((u) => u.name).join('、');
          ui.toast(`有人循香而来：${names}，并寄来一封信`, 'return');
        } else {
          ui.toast(r.movedFrom == null ? '已摆上博古架' : '已挪到这一格');
        }
        break;
      }

      case 'clear-slot': {
        const slot = v.placingSlot != null ? v.placingSlot : 0;
        SH.sys.placeSouvenir(state, slot, null);
        if (S()) S().wood();
        ui.render();
        ui.toast('已收进收藏柜');
        break;
      }

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
              v.modal = null;
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
          v.scene = 'hall';
          v.modal = null;
          ui.render();
          ui.toast('驿站已重新开张');
        }
        break;
    }
  }

  /* 全局点击分发（包括 scene 内和 toast 按钮） */
  document.addEventListener('click', (e) => {
    // 点遮罩空白处关闭弹匣
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      if (S()) S().tap();
      ui.view.modal = null;
      ui.render();
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    handleAction(el);
  });

  app.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="fast"]');
    if (!el) return;
    SH.state.settings.fastMode = el.checked;
    SH.save();
    ui.render();
    ui.toast(el.checked ? '已开启快速模式：旅行与灵草蓄露更快' : '已恢复常规闲适节奏');
  });

  /* ---------- 倒计时与灵草状态刷新 ---------- */
  function tickCountdown() {
    const now = U.now();
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const t = Number(el.dataset.return) - now;
      el.textContent = t > 0 ? U.fmtDuration(t) : '正在归来…';
    });
    let herbJustReady = false;
    document.querySelectorAll('[data-herb-ready]').forEach((el) => {
      const t = Number(el.dataset.herbReady) - now;
      if (t > 0) el.textContent = '蓄露中 · ' + U.fmtDuration(t);
      else herbJustReady = true;
    });
    if (herbJustReady && ui.view.scene === 'yard' && !ui.view.modal) {
      ui.render();
    }
  }

  /* ---------- 键盘：Escape 收起弹匣或对话气泡 ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const v = ui.view;
    if (v.modal) {
      v.modal = null;
      ui.render();
      return;
    }
    if (v.bubbleBeast || v.bubbleVisitor) {
      v.bubbleBeast = null;
      v.bubbleVisitor = null;
      ui.render();
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    const state = SH.load();
    if (isFresh(state)) {
      SH.sys.grantStarterItems(state);
    }
    if (!state.settings) state.settings = { fastMode: false, muted: false };
    if (state.settings.fastMode === undefined) state.settings.fastMode = false;
    if (state.settings.muted === undefined) state.settings.muted = false;
    if (!state.hourglass) state.hourglass = { day: U.fmtDate(U.now()), used: 0 };
    SH.sys.refreshVisitors(state);
    SH.save();

    const done = SH.sys.tick(state);
    ui.render();
    afterReturn(done);

    tickCountdown();
    setInterval(tickCountdown, 1000);
    setInterval(() => {
      const d = SH.sys.tick(SH.state);
      if (d.length) {
        ui.render();
        afterReturn(d);
      }
    }, 5000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const d = SH.sys.tick(SH.state);
        if (d.length) {
          ui.render();
          afterReturn(d);
        }
      }
    });
  }

  boot();
})();
