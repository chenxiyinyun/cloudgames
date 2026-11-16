/* 界面渲染层 —— 旅行青蛙式绘本空间交互（屋内正厅 ↔ 门前小院 + 物件弹出匣） */
(function () {
  const SH = window.SH;
  const U = SH.util;
  const A = SH.art;
  const ui = (SH.ui = {});

  /* ---------- UI 临时状态 ---------- */
  ui.view = {
    scene: 'hall',        // 'hall'（屋内正厅） | 'yard'（门前小院）
    modal: null,          // null | 'pack' | 'mail' | 'codex' | 'shelf' | 'beast' | 'settings'
    codexTab: 'progress', // 'progress' | 'souvenirs' | 'cities' | 'visitors'
    prepBeast: null,      // 整行囊选中的神兽 id
    prepPref: 'free',     // 出行方向
    prepItems: [],        // 选中的随身道具（最多 3 件）
    openLetter: null,     // 信笺桌当前展开的信 id
    placingSlot: null,    // 博古架当前选中的格位 0..11
    inspectSou: null,     // 图鉴里点击查看详情的纪念品 id
    inspectBeast: null,   // 查看记忆的神兽 id
    bubbleBeast: null,    // 屋里正显示气泡的神兽 id
    bubbleSeed: 0,
    bubbleVisitor: null,  // 庭院里正显示气泡的访客 id
    departingBeast: null, // 刚出发播放背影离场动效的神兽 id
    justPetted: null,     // 刚摸摸头的神兽 id
    herbBurst: null       // 刚采撷灵草的飘字内容
  };

  /* Toast 独立挂载在 body，支持可选一键直达按钮 */
  ui.toast = function (msg, type, action) {
    let layer = document.getElementById('toast-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'toast-layer';
      layer.className = 'toast-layer';
      layer.setAttribute('aria-live', 'polite');
      layer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(layer);
    }
    const btnHtml = action
      ? `<button class="toast-act" data-act="${U.esc(action.act)}" ${action.letter ? `data-letter="${U.esc(action.letter)}"` : ''}>${U.esc(action.label)}</button>`
      : '';
    layer.innerHTML = `<div class="toast ${type ? 'toast-' + type : ''}" role="status"><span>${U.esc(msg)}</span>${btnHtml}</div>`;
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => {
      layer.innerHTML = '';
    }, action ? 5200 : 3200);
  };

  function homeBeasts(state) {
    return SH.BEASTS.filter((b) => !state.trips[b.id]);
  }

  function unreadLetters(state) {
    return state.letters.filter((l) => l.reply && l.replied == null);
  }

  /* ---------- 角落悬浮木牌 HUD ---------- */
  function hud(state) {
    const prog = SH.sys.codexProgress(state);
    const avg = Math.round(prog.reduce((s, p) => s + p.pct, 0) / prog.length);
    const unread = unreadLetters(state).length;
    const owned = SH.sys.ownedSouvenirCount(state);
    const muted = !!(state.settings && state.settings.muted);
    const inHall = ui.view.scene === 'hall';
    const supplyReady = SH.sys.supplyRemain(state) === 0;

    return `
      <div class="hud-top">
        <button class="hud-plaque" data-act="open-modal" data-modal="codex" title="翻看《新山海经》">
          <span class="hp-seal">${A.uiStamp()}</span>
          <span class="hp-main">
            <strong>山海驿站</strong>
            <em>新山海经 ${avg}% · 藏品 ${owned}/${SH.SOUVENIRS.length}</em>
          </span>
        </button>

        <div class="hud-tools">
          <button class="hud-icon-btn" data-act="toggle-sound" aria-label="${muted ? '开启声音' : '静音'}" title="${muted ? '开启声音' : '静音'}">
            ${A.miscIcon(muted ? 'soundOff' : 'soundOn')}
          </button>
          <button class="hud-icon-btn" data-act="open-modal" data-modal="settings" aria-label="驿站杂记与存档" title="驿站杂记与存档">
            ${A.miscIcon('gear')}
          </button>
        </div>
      </div>

      <div class="hud-bottom">
        <div class="hud-tokens" role="toolbar" aria-label="驿站物件">
          <button class="token-btn" data-act="open-pack" aria-label="整理行囊">
            <span class="tb-ico">${A.navIcon('pack')}</span>
            <span>行囊</span>
          </button>
          <button class="token-btn ${unread ? 'has-badge' : ''}" data-act="open-mail" aria-label="信箱${unread ? '，' + unread + ' 封待回信' : ''}">
            <span class="tb-ico">${A.navIcon('mail')}</span>
            <span>信箱</span>
            ${unread ? `<i class="tb-badge">${unread}</i>` : ''}
          </button>
          <button class="token-btn" data-act="open-modal" data-modal="codex" aria-label="新山海经图鉴">
            <span class="tb-ico">${A.navIcon('codex')}</span>
            <span>图鉴</span>
          </button>
          <button class="token-btn" data-act="open-shelf" aria-label="堂前博古架陈设">
            <span class="tb-ico">${A.miscIcon('shelf')}</span>
            <span>陈设</span>
          </button>
        </div>

        <button class="scene-flip ${!inHall && supplyReady ? '' : inHall && (unread || supplyReady) ? 'has-hint' : ''}" data-act="toggle-scene">
          ${A.miscIcon(inHall ? 'doorOut' : 'doorIn')}
          <span>${inHall ? '出门去庭院' : '回屋进正厅'}</span>
          ${inHall && (unread || supplyReady) ? '<i class="flip-dot" aria-hidden="true"></i>' : ''}
        </button>
      </div>`;
  }

  /* ---------- 屋内正厅：博古架（直接嵌在正墙上） ---------- */
  function hallWallShelf(state) {
    const slots = [];
    for (let i = 0; i < SH.sys.SLOTS; i++) {
      const sid = state.placed[i];
      const sou = sid ? SH.sys.souById(sid) : null;
      const picking = ui.view.modal === 'shelf' && ui.view.placingSlot === i;
      slots.push(`
        <button class="wall-slot ${sou ? 'filled' : 'empty'} ${picking ? 'picking' : ''}"
          data-act="pick-wall-slot" data-slot="${i}"
          title="${sou ? U.esc(sou.name + '（点击更换）') : '第 ' + (i + 1) + ' 格（点击摆件）'}"
          aria-label="${sou ? sou.name : '空架位 ' + (i + 1)}">
          ${sou ? `<span class="ws-art">${A.souvenir(sou)}</span><span class="ws-cap">${U.esc(sou.name)}</span>` : '<span class="ws-peg"></span>'}
        </button>`);
    }
    return `
      <div class="wall-shelf" aria-label="堂前博古架">
        <div class="ws-frame">${slots.join('')}</div>
        <span class="hotspot-tag ws-tag">博古架 · 点格位摆件</span>
      </div>`;
  }

  /* ---------- 屋内正厅：三只神兽（住进屋里） ---------- */
  const HALL_SPOTS = {
    baize: { left: '24%', top: '52%', cls: 'spot-baize', bubbleDir: 'right' },
    jiuweihu: { left: '47%', top: '57%', cls: 'spot-fox', bubbleDir: 'up' },
    qingniao: { left: '71%', top: '47%', cls: 'spot-bird', bubbleDir: 'left' }
  };

  function hallBeasts(state) {
    const leftHg = SH.sys.hourglassLeft(state);
    return SH.BEASTS.map((b, idx) => {
      const bs = state.beasts[b.id];
      const trip = state.trips[b.id];
      const spot = HALL_SPOTS[b.id];

      if (trip) {
        const stop = trip.stops[0];
        const city = stop ? SH.sys.cityById(stop.city) : null;
        return `
          <div class="away-marker ${spot.cls}" style="left:${spot.left};top:${spot.top}">
            <button class="away-tag" data-act="inspect-away" data-beast="${b.id}" title="查看远行状态">
              <span class="at-name">${b.name}出门中</span>
              <span class="at-dest">去往 ${city ? city.name : '远方'}</span>
              <span class="at-time" data-countdown="${b.id}" data-return="${trip.returnAt}">${U.fmtDuration(trip.returnAt - U.now())}</span>
            </button>
            <button class="away-hg" data-act="force" data-beast="${b.id}" ${leftHg ? '' : 'disabled'} title="使用静心沙漏（今日剩 ${leftHg} 次）">
              ${A.miscIcon('hourglass')}<span>${leftHg}</span>
            </button>
          </div>`;
      }

      const openBubble = ui.view.bubbleBeast === b.id;
      const petted = ui.view.justPetted === b.id;
      const departing = ui.view.departingBeast === b.id;
      const quote = openBubble ? SH.sys.beastIdleQuote(state, b.id, ui.view.bubbleSeed) : '';

      return `
        <div class="beast-actor ${spot.cls} ${petted ? 'is-petted' : ''} ${departing ? 'is-departing' : ''}"
          style="left:${spot.left};top:${spot.top};--bob-delay:${-idx * 1.4}s">
          <button class="beast-hit" data-act="tap-beast" data-beast="${b.id}" aria-label="${b.name}，点一点打招呼">
            <span class="ba-shadow"></span>
            <span class="ba-fig">${A.beast(b.id)}</span>
            <span class="ba-name">${b.name}</span>
          </button>
          ${petted ? '<span class="pet-hearts" aria-hidden="true"><i>♥</i><i>✦</i></span>' : ''}
          ${openBubble ? `
            <div class="speech-pop dir-${spot.bubbleDir}" role="dialog" aria-label="${b.name}的话">
              <button class="sp-close" data-act="close-bubbles" aria-label="收起对话">×</button>
              <div class="sp-head"><b>${b.name}</b><span>第 ${bs.insight + 1} 阶 · ${SH.INSIGHT_STAGES[bs.insight].name}</span></div>
              <p class="sp-line">“${U.esc(quote)}”</p>
              <div class="sp-acts">
                <button class="mini-wood" data-act="open-pack" data-beast="${b.id}">替它整行囊</button>
                <button class="mini-wood ghost" data-act="open-beast-note" data-beast="${b.id}">它的记忆</button>
              </div>
            </div>` : ''}
        </div>`;
    }).join('');
  }

  /* ---------- 屋内正厅场景 ---------- */
  function hallScene(state) {
    const anyHome = homeBeasts(state).length > 0;
    return `
      <div class="scene-canvas scene-hall">
        <img class="scene-bg-img" src="assets/images/home-hall.jpg" alt="山海驿站屋内正厅" draggable="false">

        <!-- 氛围层：灯笼微光、茶炉热气、窗边浮尘 -->
        <div class="ambient-layer" aria-hidden="true">
          <span class="lantern-aura left"></span>
          <span class="lantern-aura right"></span>
          <span class="tea-steam"><i></i><i></i><i></i></span>
          <span class="sun-motes"><i></i><i></i><i></i><i></i><i></i></span>
        </div>

        <!-- 墙上山水画轴：点开新山海经 -->
        <button class="scene-hotspot hs-scroll" data-act="open-modal" data-modal="codex" aria-label="墙上山海画轴：打开新山海经图鉴">
          <span class="hs-glint"></span>
          <span class="hotspot-tag">新山海经</span>
        </button>

        <!-- 堂前博古架：12格实景陈设 -->
        ${hallWallShelf(state)}

        <!-- 窗外出口提示 -->
        <button class="scene-hotspot hs-window" data-act="toggle-scene" aria-label="从廊下出门去庭院">
          <span class="hs-door-sign">出门 · 庭院</span>
        </button>

        <!-- 桌案上的布包袱：点开整行囊 -->
        <button class="scene-hotspot hs-bundle ${anyHome ? 'ready' : ''}" data-act="open-pack" aria-label="桌案上的行囊包袱">
          <span class="bundle-art">${A.propBundle()}</span>
          <span class="hotspot-tag">整行囊出发</span>
        </button>

        <!-- 三只神兽 -->
        ${hallBeasts(state)}
      </div>`;
  }

  /* ---------- 门前小院场景 ---------- */
  function yardScene(state) {
    const unread = unreadLetters(state).length;
    const remain = SH.sys.supplyRemain(state);
    const ready = remain === 0;
    const trips = Object.keys(state.trips).map((id) => state.trips[id]);
    const leftHg = SH.sys.hourglassLeft(state);

    // 灵草丛：可采撷时露出 5 株发光灵草；蓄露时显示嫩芽
    const clovers = [
      { l: '14%', t: '46%', r: -8 },
      { l: '38%', t: '30%', r: 6 },
      { l: '58%', t: '52%', r: -4 },
      { l: '74%', t: '36%', r: 10 },
      { l: '44%', t: '68%', r: 4 }
    ]
      .map((p, i) => `<span class="clover-sprig" style="left:${p.l};top:${p.t};--rot:${p.r}deg;--d:${i * 0.35}s">${A.propClover()}</span>`)
      .join('');

    // 已解锁访客：随机/顺序出现在长凳旁
    const unlockedVisitors = SH.VISITORS.filter((v) => state.visitors[v.id]);
    const visitorHtml = unlockedVisitors
      .slice(0, 3)
      .map((v, i) => {
        const open = ui.view.bubbleVisitor === v.id;
        const leftPct = 42 + i * 7.5;
        return `
          <div class="yard-visitor" style="left:${leftPct}%;top:51%">
            <button class="yv-hit" data-act="tap-visitor" data-visitor="${v.id}" aria-label="访客 ${v.name}">
              <span class="yv-fig">${A.propVisitor(v.id)}</span>
              <span class="yv-name">${v.name}</span>
            </button>
            ${open ? `
              <div class="speech-pop dir-up" role="dialog" aria-label="${v.name}">
                <button class="sp-close" data-act="close-bubbles" aria-label="收起">×</button>
                <div class="sp-head"><b>${v.name}</b><span>驿站常客</span></div>
                <p class="sp-line">${U.esc(v.line)}</p>
                ${v.bonus ? `<p class="sp-bonus">常驻祈福：${Object.keys(v.bonus).map((t) => SH.sys.tagName(t) + ' ×' + v.bonus[t]).join('，')}</p>` : ''}
              </div>` : ''}
          </div>`;
      })
      .join('');

    // 月洞门远行路牌
    const gateTrips = trips.length
      ? trips
          .map((t) => {
            const stop = t.stops[0];
            const city = stop ? SH.sys.cityById(stop.city) : null;
            return `
              <div class="gate-trip-card">
                <span class="gtc-fig">${A.beast(t.beastId)}</span>
                <span class="gtc-info">
                  <b>${t.beastName} → ${city ? city.name : '远方'}</b>
                  <em data-countdown="${t.beastId}" data-return="${t.returnAt}">${U.fmtDuration(t.returnAt - U.now())}</em>
                </span>
                <button class="away-hg" data-act="force" data-beast="${t.beastId}" ${leftHg ? '' : 'disabled'} title="静心沙漏（今日剩 ${leftHg} 次）">
                  ${A.miscIcon('hourglass')}<span>${leftHg}</span>
                </button>
              </div>`;
          })
          .join('')
      : `<button class="gate-idle-sign" data-act="open-pack">
          <span>山海路远 · 点此整装出发</span>
        </button>`;

    return `
      <div class="scene-canvas scene-yard">
        <img class="scene-bg-img" src="assets/images/home-yard.jpg" alt="山海驿站门前小院" draggable="false">

        <!-- 氛围：桂花飘落、灯笼微光 -->
        <div class="ambient-layer" aria-hidden="true">
          <span class="lantern-aura yard-l1"></span>
          <span class="lantern-aura yard-l2"></span>
          <span class="osmanthus-petals"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </div>

        <!-- 廊下回屋入口 -->
        <button class="scene-hotspot hs-porch" data-act="toggle-scene" aria-label="回屋进正厅">
          <span class="hs-door-sign">回屋 · 正厅</span>
        </button>

        <!-- 朱漆木信箱 -->
        <button class="scene-hotspot hs-mailbox ${unread ? 'has-mail' : ''}" data-act="open-mail" aria-label="门口信箱${unread ? '，有 ' + unread + ' 封待回信' : ''}">
          ${unread ? `<span class="mailbox-env">${A.propMailFlag()}</span><span class="mailbox-count">${unread}</span>` : ''}
          <span class="hotspot-tag">${unread ? '有新来信 · 拆信' : '驿站信箱'}</span>
        </button>

        <!-- 长凳旁访客 -->
        ${visitorHtml}

        <!-- 月洞门远行路口 -->
        <div class="gate-waystone">${gateTrips}</div>

        <!-- 灵草药圃（类似旅行青蛙的三叶草采撷区） -->
        <button class="scene-hotspot hs-herbs ${ready ? 'ready' : 'growing'}" data-act="harvest-herbs"
          aria-label="${ready ? '采撷灵草补给行囊' : '灵草正在蓄露中'}">
          ${ready ? clovers : ''}
          ${ui.view.herbBurst ? `<span class="herb-burst" aria-hidden="true">${U.esc(ui.view.herbBurst)}</span>` : ''}
          <span class="hotspot-tag" ${ready ? '' : `data-herb-ready="${(state.lastSupply || 0) + SH.sys.supplyCooldownMs(state)}"`}>${ready ? '采撷灵草 · 得行囊物件' : '蓄露中 · ' + U.fmtDuration(remain)}</span>
        </button>
      </div>`;
  }

  /* ---------- 弹匣 1：包袱桌面（替代填表式“行囊”页） ---------- */
  function packModal(state) {
    const v = ui.view;
    // 默认自动选中第一只在家的神兽
    if (!v.prepBeast || state.trips[v.prepBeast]) {
      const firstHome = homeBeasts(state)[0];
      v.prepBeast = firstHome ? firstHome.id : null;
    }
    const beastId = v.prepBeast;
    const beast = beastId ? SH.sys.beastById(beastId) : null;
    const pref = SH.PREFERENCES.find((p) => p.id === v.prepPref) || SH.PREFERENCES[0];

    const beastTokens = SH.BEASTS.map((b) => {
      const trip = state.trips[b.id];
      const on = beastId === b.id && !trip;
      return `
        <button class="pack-beast-tab ${on ? 'on' : ''} ${trip ? 'busy' : ''}" data-act="pick-beast" data-beast="${b.id}" ${trip ? 'disabled' : ''}>
          <span class="pbt-fig">${A.beast(b.id)}</span>
          <span class="pbt-txt">
            <b>${b.name}</b>
            <em>${trip ? '在路上' : b.title}</em>
          </span>
        </button>`;
    }).join('');

    // 包袱布上的 3 个圆孔
    const clothSlots = [0, 1, 2]
      .map((idx) => {
        const iid = v.prepItems[idx];
        const it = iid ? SH.sys.itemById(iid) : null;
        return it
          ? `<button class="cloth-slot filled" data-act="unpick-item" data-item="${it.id}" title="点一下放回柜里">
              <span class="cs-art">${A.item(it)}</span>
              <span class="cs-name">${it.name}</span>
            </button>`
          : `<span class="cloth-slot empty" aria-hidden="true"><i>空</i></span>`;
      })
      .join('');

    const prefSlips = SH.PREFERENCES.map(
      (p) =>
        `<button class="way-slip ${v.prepPref === p.id ? 'on' : ''}" data-act="pick-pref" data-pref="${p.id}" title="${U.esc(p.desc)}">
          ${p.name}
        </button>`
    ).join('');

    const cubbies = SH.ITEMS.map((it) => {
      const n = state.inventory[it.id] || 0;
      const sel = v.prepItems.indexOf(it.id) >= 0;
      return `
        <button class="cubby ${sel ? 'on' : ''} ${n ? '' : 'gone'}" data-act="pick-item" data-item="${it.id}" title="${U.esc(it.desc)}">
          <span class="cubby-art">${A.item(it)}</span>
          <span class="cubby-name">${it.name}</span>
          <span class="cubby-hint">${it.hint}</span>
          <span class="cubby-n">×${n}</span>
        </button>`;
    }).join('');

    const durMin = Math.round((SH.sys.DURATION.base + SH.sys.DURATION.perStop) / 60000);
    const durMax = Math.round((SH.sys.DURATION.base + SH.sys.DURATION.perStop * 2 + 6 * 60000) / 60000);
    const whisper = beast
      ? `${beast.name}偏爱${Object.keys(beast.cityPref || {}).map((c) => SH.sys.cityById(c).name).join('、')} · ${pref.desc}`
      : '眼下三只神兽都在外游历，等其中一只回来再收拾包袱吧。';

    return `
      <div class="modal-card modal-pack" role="dialog" aria-modal="true" aria-label="整理行囊">
        <div class="modal-head">
          <h2>桌案包袱</h2>
          <span class="mh-sub">点物件放进包袱，再系紧送它出门</span>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>

        <div class="pack-beasts">${beastTokens}</div>

        <div class="pack-layout">
          <div class="furoshiki-zone">
            <div class="furoshiki-cloth">
              <div class="cloth-label">随身包袱（${v.prepItems.length}/3）</div>
              <div class="cloth-slots">${clothSlots}</div>
            </div>

            <div class="way-box">
              <div class="way-label">出行路引</div>
              <div class="way-slips">${prefSlips}</div>
            </div>

            <div class="fortune-strip">${U.esc(whisper)}</div>
          </div>

          <div class="cubby-tray">
            <div class="cubby-title">木格行囊柜 <em>点击取用 / 庭院灵草可补给</em></div>
            <div class="cubby-grid">${cubbies}</div>
          </div>
        </div>

        <div class="modal-foot">
          <span class="mf-note">${beast ? (state.settings.fastMode ? '快速模式：约 1–3 分钟归来' : `约 ${durMin}–${durMax} 分钟归来，关掉页面也在路上`) : '三只都出门了'}</span>
          <button class="wood-btn seal-btn" data-act="depart" ${beast ? '' : 'disabled'}>
            <span>扎紧包袱 · 送它出门</span>
          </button>
        </div>
      </div>`;
  }

  /* ---------- 弹匣 2：信笺桌（拆信与回信） ---------- */
  function mailModal(state) {
    if (!state.letters.length) {
      return `
        <div class="modal-card modal-mail empty-mail" role="dialog" aria-modal="true" aria-label="驿站信箱">
          <div class="modal-head">
            <h2>驿站信箱</h2>
            <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
          </div>
          <div class="mail-empty-box">
            <div class="meb-art">${A.uiEnvelope()}</div>
            <p class="meb-title">信箱里还空着</p>
            <p class="meb-desc">屋里桌案上摆着包袱，送一只神兽出门，它走远了就会给你寄信。</p>
            <button class="wood-btn" data-act="open-pack">去屋里整行囊</button>
          </div>
        </div>`;
    }

    // 默认选中第一封待回信或最新一封
    if (!ui.view.openLetter || !state.letters.some((l) => l.id === ui.view.openLetter)) {
      const target = unreadLetters(state)[0] || state.letters[0];
      ui.view.openLetter = target ? target.id : null;
    }

    const cur = state.letters.find((l) => l.id === ui.view.openLetter) || state.letters[0];
    const unread = unreadLetters(state).length;
    const WEATHERS = ['sunny', 'cloudy', 'rain', 'snow', 'night'];
    const weather = WEATHERS.indexOf(cur.weather) >= 0 ? cur.weather : '';
    const city = cur.city ? SH.sys.cityById(cur.city) : null;
    const sou = cur.souvenir ? SH.sys.souById(cur.souvenir) : null;

    const listHtml = state.letters
      .map((l) => {
        const active = l.id === cur.id;
        const need = !!(l.reply && l.replied == null);
        return `
          <button class="env-tab ${active ? 'on' : ''} ${l.stage ? 'stage' : ''} ${l.visitor ? 'visitor' : ''}"
            data-act="select-letter" data-letter="${U.esc(l.id)}">
            <span class="et-stamp">${A.uiStamp()}</span>
            <span class="et-info">
              <b>${U.esc(l.title)}</b>
              <em>${U.esc(l.beastName)} · ${U.esc(l.cityName)}</em>
            </span>
            ${need ? '<i class="et-dot" title="待回信">待回</i>' : l.stage ? '<i class="et-tag">阶段</i>' : ''}
          </button>`;
      })
      .join('');

    const causesHtml =
      cur.causes && cur.causes.length
        ? `<div class="causes"><span class="causes-label">因为</span>${cur.causes
            .map((c) => `<span class="cause-pill">${U.esc(c)}</span>`)
            .join('')}</div>`
        : '';

    const souHtml = sou
      ? `<div class="gain">
           <span class="gain-art">${A.souvenir(sou)}</span>
           <span class="gain-text"><b>带回「${sou.name}」</b><em>${sou.desc}</em></span>
         </div>`
      : '';

    let replyHtml = '';
    if (cur.reply) {
      if (cur.replied != null) {
        replyHtml = `<div class="replied"><span class="replied-mark">已寄回信</span><span>「${U.esc(cur.reply[cur.replied].text)}」</span><em>${cur.visitor ? '驿站记住了这句话。' : '它记住了。'}</em></div>`;
      } else {
        replyHtml = `
          <div class="reply-box" role="group" aria-label="回信选项">
            <p class="reply-q">提笔回一句给${U.esc(cur.beastName)}：</p>
            ${cur.reply
              .map(
                (r, i) => `
              <button class="reply-opt" data-act="reply" data-letter="${U.esc(cur.id)}" data-idx="${i}">
                <i aria-hidden="true">${'一二三'[i] || '·'}</i>
                <span>${U.esc(r.text)}</span>
              </button>`
              )
              .join('')}
          </div>`;
      }
    }

    return `
      <div class="modal-card modal-mail" role="dialog" aria-modal="true" aria-label="驿站信笺">
        <div class="modal-head">
          <h2>驿站信箱</h2>
          <span class="mh-sub">${state.letters.length} 封信 · ${unread ? unread + ' 封待回信' : '都已回信'}</span>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>

        <div class="mail-desk">
          <div class="env-list" aria-label="来信列表">${listHtml}</div>
          <div class="letter-pane">
            <div class="sheet ${weather ? 'weather-' + weather : ''}">
              ${A.uiLetter()}
              ${city ? `<div class="sheet-photo">${A.city(city)}</div>` : ''}
              <div class="sheet-weather" aria-label="天气">${weather ? A.weatherIcon(weather) : ''}</div>
              <h3 class="sheet-title">${U.esc(cur.title)}</h3>
              <div class="sheet-body">${U.esc(cur.body).replace(/\n/g, '<br>')}</div>
              <div class="sheet-sign">—— ${U.esc(cur.beastName)} 于 ${U.esc(cur.cityName)}，${U.fmtDate(cur.at)}</div>
            </div>
            ${causesHtml}
            ${souHtml}
            ${replyHtml}
          </div>
        </div>
      </div>`;
  }

  /* ---------- 弹匣 3：《新山海经》绘本图鉴 ---------- */
  function codexModal(state) {
    const tab = ui.view.codexTab || 'progress';
    const tabs = [
      ['progress', '编纂进度'],
      ['souvenirs', '纪念品柜'],
      ['cities', '山河足迹'],
      ['visitors', '驿站访客']
    ];

    let body = '';
    if (tab === 'progress') {
      const prog = SH.sys.codexProgress(state);
      const bars = prog
        .map(
          (p) => `
          <div class="ink-row">
            <span class="ink-name">${p.name}</span>
            <span class="ink-bar"><i style="width:${p.pct}%"></i></span>
            <span class="ink-num">${p.pct}%</span>
          </div>`
        )
        .join('');
      const beastArcs = SH.BEASTS.map((b) => {
        const bs = state.beasts[b.id];
        const st = SH.INSIGHT_STAGES[bs.insight];
        return `
          <div class="arc-card">
            <span class="ac-fig">${A.beast(b.id)}</span>
            <div class="ac-info">
              <b>${b.name} · 第 ${bs.insight + 1} 阶「${st.name}」</b>
              <p>${st.desc}</p>
              <em>出行 ${bs.travels} 次 · 见闻 ${bs.insightExp} · 到访 ${Object.keys(bs.visited).length} 城</em>
            </div>
          </div>`;
      }).join('');
      body = `
        <div class="codex-hero">
          ${A.codexCover()}
          <div>
            <h3>《新山海经》编纂录</h3>
            <p class="hint">上古的山海图已久未更新。神兽们从现代人间带回的每一页见闻与纪念品，都在把这卷书重新补全。</p>
            <div class="ink-wrap">${bars}</div>
          </div>
        </div>
        <div class="arc-list">${beastArcs}</div>`;
    } else if (tab === 'souvenirs') {
      const selSou = ui.view.inspectSou && state.souvenirs[ui.view.inspectSou] ? SH.sys.souById(ui.view.inspectSou) : null;
      const shelf = SH.SOUVENIRS.map((s) => {
        const n = state.souvenirs[s.id] || 0;
        const have = n > 0;
        const city = s.city === '*' ? '旅途各处' : (SH.sys.cityById(s.city) || {}).name || '';
        return `
          <button class="frame ${have ? 'have' : 'locked'} r-${s.rarity} ${ui.view.inspectSou === s.id ? 'focus' : ''}"
            data-act="inspect-sou" data-sou="${s.id}" ${have ? '' : 'disabled'}>
            <div class="frame-art">${A.souvenir(s)}</div>
            <div class="frame-name">${have ? s.name : '？？？'}</div>
            <div class="frame-city">${have ? city : ''}${have && n > 1 ? ' ×' + n : ''}</div>
            ${have && s.rarity === 'legend' ? '<i class="frame-shine"></i>' : ''}
          </button>`;
      }).join('');
      body = `
        ${selSou ? `
          <div class="sou-inspect">
            <span class="si-art">${A.souvenir(selSou)}</span>
            <div class="si-txt">
              <b>${selSou.name}</b>
              <p>${selSou.desc}</p>
              <em>招客气息：${(selSou.attract || []).map((t) => SH.sys.tagName(t)).join('、') || '暂无'}</em>
            </div>
          </div>` : '<p class="hint">点已收到的纪念品，可细看它的来历。把它们摆上屋里的博古架，还会引来访客。</p>'}
        <div class="shelf">${shelf}</div>`;
    } else if (tab === 'cities') {
      const cards = SH.CITIES.map((c) => {
        const n = SH.BEASTS.reduce((s, b) => s + (state.beasts[b.id].visited[c.id] || 0), 0);
        return `
          <div class="postcard ${n ? 'have' : 'locked'}">
            <div class="postcard-photo">${A.city(c)}</div>
            <div class="postcard-body">
              <b>${c.name} · ${c.region}</b>
              <span>${n ? '到访 ' + n + ' 次' : '尚未踏足'}</span>
              <em>${n ? c.intro : '给神兽带上喜欢的路引与物件，去遇见这座城。'}</em>
            </div>
          </div>`;
      }).join('');
      body = `<div class="postcard-row">${cards}</div>`;
    } else {
      const cards = SH.VISITORS.map((v) => {
        const un = state.visitors[v.id];
        const need = v.need.map((t) => SH.sys.tagName(t)).join(' / ');
        return `
          <div class="guest ${un ? 'have' : 'locked'}">
            <span class="g-fig">${A.propVisitor(v.id)}</span>
            <div class="g-txt">
              <b>${un ? v.name : '？？？'}</b>
              <span>${un ? v.line : '在博古架摆出 ' + need + ' 类纪念品共 ' + v.count + ' 件'}</span>
              ${un && v.bonus ? `<em>常驻祈福：${Object.keys(v.bonus).map((t) => SH.sys.tagName(t) + ' ×' + v.bonus[t]).join('，')}</em>` : ''}
            </div>
          </div>`;
      }).join('');
      body = `<div class="guest-row">${cards}</div>`;
    }

    return `
      <div class="modal-card modal-codex" role="dialog" aria-modal="true" aria-label="新山海经图鉴">
        <div class="modal-head">
          <h2>新山海经</h2>
          <div class="book-tabs" role="tablist">
            ${tabs
              .map(
                ([id, name]) =>
                  `<button class="book-tab ${tab === id ? 'on' : ''}" data-act="codex-tab" data-tab="${id}" role="tab" aria-selected="${tab === id}">${name}</button>`
              )
              .join('')}
          </div>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="modal-scroll">${body}</div>
      </div>`;
  }

  /* ---------- 弹匣 4：博古架陈设匣 ---------- */
  function shelfModal(state) {
    const slot = ui.view.placingSlot != null ? ui.view.placingSlot : 0;
    ui.view.placingSlot = slot;
    const slotHas = state.placed[slot];
    const used = Object.keys(state.placed).map((k) => state.placed[k]);

    const miniGrid = Array.from({ length: SH.sys.SLOTS }, (_, i) => {
      const s = state.placed[i] ? SH.sys.souById(state.placed[i]) : null;
      return `
        <button class="mini-slot ${i === slot ? 'on' : ''} ${s ? 'filled' : ''}" data-act="select-shelf-slot" data-slot="${i}">
          ${s ? A.souvenir(s) : `<span>${i + 1}</span>`}
        </button>`;
    }).join('');

    const opts = SH.SOUVENIRS.filter((s) => state.souvenirs[s.id] > 0)
      .map((s) => {
        const usedElsewhere = used.indexOf(s.id) >= 0 && slotHas !== s.id;
        return `
          <button class="pick-sou ${usedElsewhere ? 'used' : ''} ${slotHas === s.id ? 'cur' : ''}" data-act="place" data-sou="${s.id}">
            <span class="ps-art">${A.souvenir(s)}</span>
            <span class="ps-name">${s.name}</span>
            <span class="ps-desc">${s.desc}</span>
            ${usedElsewhere ? '<span class="ps-tag">挪过来</span>' : ''}
          </button>`;
      })
      .join('');

    return `
      <div class="modal-card modal-shelf" role="dialog" aria-modal="true" aria-label="博古架陈设">
        <div class="modal-head">
          <h2>博古架 · 第 ${slot + 1} 格</h2>
          <span class="mh-sub">摆满喜欢的纪念品，会有人循香找上门来</span>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="shelf-mini-bar">${miniGrid}</div>
        <div class="shelf-actions">
          <span>选一件摆到第 ${slot + 1} 格：</span>
          <button class="wood-btn tiny" data-act="clear-slot" ${slotHas ? '' : 'disabled'}>从这一格取下</button>
        </div>
        <div class="modal-scroll">
          <div class="picker-list">${opts || '<p class="muted">还没有收集到纪念品。先送神兽出门旅行吧。</p>'}</div>
        </div>
      </div>`;
  }

  /* ---------- 弹匣 5：神兽的记忆与随记 ---------- */
  function beastNoteModal(state) {
    const id = ui.view.inspectBeast || 'baize';
    const b = SH.sys.beastById(id) || SH.BEASTS[0];
    const bs = state.beasts[b.id];
    const st = SH.INSIGHT_STAGES[bs.insight];
    const mems = (bs.memoryOrder || [])
      .slice(-8)
      .reverse()
      .map((k) => SH.MEMORY_LINES && SH.MEMORY_LINES[k])
      .filter(Boolean);

    return `
      <div class="modal-card modal-beast" role="dialog" aria-modal="true" aria-label="${b.name}的随记">
        <div class="modal-head">
          <h2>${b.name} · ${b.title}</h2>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="beast-note-body">
          <div class="bnb-top">
            <span class="bnb-fig">${A.beast(b.id)}</span>
            <div>
              <span class="bnb-stage">认知第 ${bs.insight + 1} 阶：${st.name}</span>
              <p class="bnb-desc">${b.desc}</p>
              <p class="bnb-quirk">${b.quirk}</p>
            </div>
          </div>
          <div class="bnb-memories">
            <h3>它记住的那些话</h3>
            ${mems.length
              ? `<ul>${mems.map((m) => `<li>${U.esc(m)}</li>`).join('')}</ul>`
              : '<p class="muted">还没有聊过太多。等它寄信回来，给它回一封信吧。</p>'}
          </div>
        </div>
        <div class="modal-foot">
          <span class="mf-note">已出行 ${bs.travels} 次 · 到访 ${Object.keys(bs.visited).length} 城</span>
          ${state.trips[b.id]
            ? '<span class="mf-note">它正在路上</span>'
            : `<button class="wood-btn" data-act="open-pack" data-beast="${b.id}">替它整行囊</button>`}
        </div>
      </div>`;
  }

  /* ---------- 弹匣 6：驿站杂记与存档 ---------- */
  function settingsModal(state) {
    const left = SH.sys.hourglassLeft(state);
    const remain = SH.sys.supplyRemain(state);
    return `
      <div class="modal-card modal-settings" role="dialog" aria-modal="true" aria-label="驿站杂记与存档">
        <div class="modal-head">
          <h2>驿站杂记</h2>
          <button class="modal-close" data-act="close-modal" aria-label="关闭">×</button>
        </div>
        <div class="settings-body">
          <div class="guide-box">
            <b>如何游玩</b>
            <p>① 点屋里茶桌上的<b>布包袱</b>（或直接点一只神兽），选好路引与随身物件送它出门。</p>
            <p>② 去<b>庭院</b>采撷发光的<b>灵草</b>补充物件；有新来信时，门口的<b>木信箱</b>会露出红封。</p>
            <p>③ 拆信后可三选一回信，神兽会记住你的话；把纪念品摆上屋里的<b>博古架</b>，还能招来访客。</p>
          </div>
          <div class="set-row">
            <label class="switch">
              <input type="checkbox" data-act="fast" ${state.settings.fastMode ? 'checked' : ''}>
              <span>快速模式（缩短旅行与灵草蓄露时间，方便连续体验）</span>
            </label>
          </div>
          <div class="set-meta">
            <span>今日静心沙漏：剩 ${left}/${SH.sys.HOURGLASS_LIMIT} 次</span>
            <span>灵草蓄露：${remain ? '还需 ' + U.fmtDuration(remain) : '已可采撷'}</span>
          </div>
          <div class="set-btns">
            <button class="wood-btn tiny" data-act="export">导出存档</button>
            <button class="wood-btn tiny" data-act="import">导入存档</button>
            <button class="wood-btn tiny danger" data-act="reset">重置存档</button>
          </div>
        </div>
      </div>`;
  }

  function renderModal(state) {
    const m = ui.view.modal;
    if (!m) return '';
    const inner =
      m === 'pack' ? packModal(state)
      : m === 'mail' ? mailModal(state)
      : m === 'codex' ? codexModal(state)
      : m === 'shelf' ? shelfModal(state)
      : m === 'beast' ? beastNoteModal(state)
      : settingsModal(state);
    return `<div class="modal-backdrop" data-act="backdrop-close">${inner}</div>`;
  }

  /* ---------- 总渲染 ---------- */
  ui.render = function () {
    const state = SH.state;
    const scroller = document.querySelector('.scene-scroller');
    const prevScrollLeft = scroller ? scroller.scrollLeft : null;

    const sceneHtml = ui.view.scene === 'yard' ? yardScene(state) : hallScene(state);

    document.getElementById('app').innerHTML = `
      <div class="game-shell">
        ${A.uiPaper()}
        <div class="viewport">
          <div class="scene-scroller">${sceneHtml}</div>
          <button class="pan-hint left" data-act="pan" data-dir="-1" aria-label="向左查看">‹</button>
          <button class="pan-hint right" data-act="pan" data-dir="1" aria-label="向右查看">›</button>
          ${hud(state)}
          ${renderModal(state)}
        </div>
      </div>`;

    const nextScroller = document.querySelector('.scene-scroller');
    if (nextScroller) {
      if (prevScrollLeft != null) {
        nextScroller.scrollLeft = prevScrollLeft;
      } else {
        // 窄屏竖版初始自动居中显示主屋/庭院
        nextScroller.scrollLeft = Math.max(0, (nextScroller.scrollWidth - nextScroller.clientWidth) / 2);
      }
    }
  };
})();
