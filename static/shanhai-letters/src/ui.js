/* 界面渲染层 —— 绘本小屋风（参考旅行青蛙：物件隐喻、暖色、无卡片堆砌） */
(function () {
  const SH = window.SH;
  const U = SH.util;
  const A = SH.art;
  const ui = (SH.ui = {});

  /* ---------- UI 临时状态 ---------- */
  ui.view = {
    tab: 'yard',
    prepBeast: null,
    prepPref: 'free',
    prepItems: [],
    openLetter: null,
    placingSlot: null,
    drawerOpen: false,
    prevTab: null
  };

  /* Toast 独立挂载在 body，不触发整页重绘，也不会打断键盘焦点 */
  ui.toast = function (msg, type) {
    let layer = document.getElementById('toast-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'toast-layer';
      layer.className = 'toast-layer';
      layer.setAttribute('aria-live', 'polite');
      layer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(layer);
    }
    layer.innerHTML = `<div class="toast ${type ? 'toast-' + type : ''}" role="status">${U.esc(msg)}</div>`;
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => {
      layer.innerHTML = '';
    }, 3200);
  };

  function actKey(el) {
    if (!el || !el.dataset || !el.dataset.act) return null;
    return Object.keys(el.dataset)
      .sort()
      .map((k) => k + '=' + el.dataset[k])
      .join('&');
  }

  /* ---------- 挂在梁上的匾额（代替网页 topbar） ---------- */
  function plaque(state) {
    const prog = SH.sys.codexProgress(state);
    const avg = Math.round(prog.reduce((s, p) => s + p.pct, 0) / prog.length);
    const unread = state.letters.filter((l) => l.reply && l.replied == null).length;
    return `
      <header class="plaque">
        <div class="plaque-rope"></div>
        <div class="plaque-board">
          ${A.uiScroll()}
          <div class="plaque-text">
            <h1>山海来信</h1>
            <p>上古的山海图，已经很久没有更新了</p>
          </div>
          ${A.uiStamp()}
        </div>
        <div class="plaque-tags">
          <span class="tag"><i>新山海经</i><b>${avg}%</b></span>
          <span class="tag"><i>纪念品</i><b>${SH.sys.ownedSouvenirCount(state)}/${SH.SOUVENIRS.length}</b></span>
          <span class="tag ${unread ? 'hot' : ''}"><i>待回信</i><b>${unread}</b></span>
        </div>
      </header>`;
  }

  /* ---------- 底部木牌导航（物件隐喻，不是网页 tab） ---------- */
  function dock() {
    const items = [
      ['yard', '庭院', 'yard'],
      ['prepare', '行囊', 'pack'],
      ['mailbox', '信箱', 'mail'],
      ['codex', '图鉴', 'codex'],
      ['home', '驿站', 'home']
    ];
    const unread = SH.state.letters.filter((l) => l.reply && l.replied == null).length;
    return `<nav class="dock" aria-label="主导航">${items
      .map(([id, name, icon]) => {
        const on = ui.view.tab === id;
        const dot = id === 'mailbox' && unread ? '<i class="dock-dot" aria-hidden="true"></i>' : '';
        const label = id === 'mailbox' && unread ? `${name}，${unread} 封待回信` : name;
        return `<button class="dock-tile ${on ? 'on' : ''}" data-act="tab" data-tab="${id}"
          aria-current="${on ? 'page' : 'false'}" aria-label="${label}">
          ${A.navIcon(icon)}<span aria-hidden="true">${name}</span>${dot}</button>`;
      })
      .join('')}</nav>`;
  }

  /* ---------- 庭院：小院场景 + 神兽木牌 ---------- */
  function tripPlank(trip) {
    if (!trip.stops || !trip.stops.length) return '';
    const names = trip.stops
      .map((s) => {
        const c = SH.sys.cityById(s.city);
        return c ? c.name : '';
      })
      .filter(Boolean)
      .join(' · ');
    return `<div class="trip-plank">${A.uiPlank()}<span>去了 ${U.esc(names)}</span></div>`;
  }

  function speech(text, cls) {
    return `<div class="speech ${cls || ''}"><p>${text}</p></div>`;
  }

  function yard(state) {
    const stations = SH.BEASTS.map((b) => {
      const bs = state.beasts[b.id];
      const trip = state.trips[b.id];
      const stage = SH.INSIGHT_STAGES[bs.insight];
      const left = trip ? SH.sys.hourglassLeft(state) : 0;
      let below, bubble;

      if (trip) {
        const remain = trip.returnAt - U.now();
        const total = Math.max(1, trip.returnAt - trip.departAt);
        const pct = Math.max(0, Math.min(100, ((U.now() - trip.departAt) / total) * 100));
        bubble = speech(`路上。${U.fmtDate(trip.departAt)} 出的门。`, 'away');
        below = `
          <div class="countdown" data-countdown="${b.id}" data-return="${trip.returnAt}">${U.fmtDuration(remain)}</div>
          <div class="trip-progress" data-progress data-depart="${trip.departAt}" data-return="${trip.returnAt}" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>
          <button class="wood-btn small" data-act="force" data-beast="${b.id}" ${left ? '' : 'disabled'}>
            ${A.miscIcon('hourglass')}<span>静心沙漏 · ${left} 次</span>
          </button>`;
      } else {
        bubble = speech(bs.insight === 0 ? '人间……好大。' : stage.desc, '');
        below = `
          <button class="wood-btn small" data-act="goto-prepare" data-beast="${b.id}">
            ${A.navIcon('pack')}<span>为它准备行囊</span>
          </button>`;
      }

      return `
        <article class="station ${trip ? 'away' : ''}" aria-label="${b.name}${trip ? '，在路上' : ''}">
          ${trip ? tripPlank(trip) : ''}
          <div class="station-fig">${A.beast(b.id)}<i class="fig-shadow"></i></div>
          ${bubble}
          <div class="station-name">
            <b>${b.name}</b><span>${b.title}</span>
          </div>
          <div class="station-stage">第 ${bs.insight + 1} 阶 · ${stage.name}</div>
          <div class="station-stats">
            <span>出行 ${bs.travels}</span>
            <span>见闻 ${bs.insightExp}</span>
            <span>到访 ${Object.keys(bs.visited).length} 城</span>
          </div>
          ${below}
        </article>`;
    }).join('');

    return `
      <section class="scene yard-scene">
        <div class="scene-bg">${A.scene('yard', '<span class="scene-fallback"></span>')}</div>
        <div class="scene-vignette"></div>
        <div class="station-row">${stations}</div>
        <p class="scene-tip">神兽出门以后不用守着。关掉页面，它也在路上。</p>
      </section>`;
  }

  /* ---------- 行囊：铺开的包袱皮 ---------- */
  function prepare(state) {
    const v = ui.view;
    const beastId = v.prepBeast;

    const beastRow = SH.BEASTS.map((b) => {
      const trip = state.trips[b.id];
      const cls = (beastId === b.id ? 'on ' : '') + (trip ? 'busy' : '');
      return `<button class="beast-tag ${cls}" data-act="pick-beast" data-beast="${b.id}"
        aria-pressed="${beastId === b.id}" aria-disabled="${trip ? 'true' : 'false'}">
        <span class="bt-fig">${A.beast(b.id)}</span>
        <span class="bt-name">${b.name}</span>
        <span class="bt-sub">${trip ? '在路上' : b.title}</span>
      </button>`;
    }).join('');

    const prefRow = SH.PREFERENCES.map(
      (p) =>
        `<button class="slip ${v.prepPref === p.id ? 'on' : ''}" data-act="pick-pref" data-pref="${p.id}"
          aria-pressed="${v.prepPref === p.id}"><span>${p.name}</span></button>`
    ).join('');

    const inv = SH.ITEMS.map((it) => {
      const n = state.inventory[it.id] || 0;
      const sel = v.prepItems.indexOf(it.id) >= 0;
      return `<button class="knick ${sel ? 'on' : ''} ${n ? '' : 'gone'}" data-act="pick-item" data-item="${it.id}"
        aria-pressed="${sel}" aria-disabled="${n ? 'false' : 'true'}" title="${U.esc(it.desc)}">
        <span class="knick-art">${A.item(it)}</span>
        <span class="knick-name">${it.name}</span>
        <span class="knick-n">×${n}</span>
        <span class="knick-hint">${it.hint}</span>
      </button>`;
    }).join('');

    const beast = beastId ? SH.sys.beastById(beastId) : null;
    const pref = SH.PREFERENCES.find((p) => p.id === v.prepPref) || SH.PREFERENCES[0];
    const items = v.prepItems.map((id) => SH.sys.itemById(id)).filter(Boolean);

    let forecast = '<div class="fortune empty"><p>选好神兽，就能看到这次旅行的倾向。</p></div>';
    if (beast) {
      const lines = [];
      lines.push(`${beast.name} 偏爱 ${beast.cityPref ? Object.keys(beast.cityPref).map((c) => SH.sys.cityById(c).name).join('、') : '各处'}。`);
      lines.push(`选「${pref.name}」：${pref.desc}`);
      lines.push(
        items.length
          ? `带上 ${items.map((i) => `「${i.name}」`).join('、')} —— ${items.map((i) => i.hint).join('；')}。`
          : '什么也没带。它得自己想办法。'
      );
      forecast = `<div class="fortune">
        <div class="fortune-head">这一签</div>
        ${lines.map((l) => `<p>${l}</p>`).join('')}
        <p class="fortune-unknown">实际目的地与遭遇仍有随机性 —— 你只能影响倾向，不能决定结果。</p>
      </div>`;
    }

    const canGo = !!(beastId && !state.trips[beastId]);
    const durationMin = Math.round((SH.sys.DURATION.base + SH.sys.DURATION.perStop) / 60000);
    const durationMax = Math.round((SH.sys.DURATION.base + SH.sys.DURATION.perStop * 2 + 6 * 60000) / 60000);
    const goNote = !beastId
      ? '先选一只神兽'
      : state.trips[beastId]
        ? '它还在路上，等它回来'
        : `路上约 ${durationMin}–${durationMax} 分钟${state.settings.fastMode ? '（快速模式，更短）' : ''}`;
    return `
      <section class="scene pack-scene">
        <div class="scene-bg">${A.scene('hall', '<span class="scene-fallback"></span>')}</div>
        <div class="scene-vignette"></div>
        <div class="pack-body">
          <h2 class="brush-title">谁要出门？</h2>
          <div class="beast-row">${beastRow}</div>

          <h2 class="brush-title">想去什么方向</h2>
          <div class="slip-row">${prefRow}</div>
          <p class="hint">${pref.desc}</p>

          <h2 class="brush-title">随身带点什么 <em>已选 ${v.prepItems.length}/3</em></h2>
          <div class="knick-board">${inv}</div>

          ${forecast}

          <div class="go-row">
            <button class="wood-btn big" ${canGo ? '' : 'disabled'} data-act="depart">
              ${A.navIcon('pack')}<span>送它出发</span>
            </button>
            <span class="go-note">${goNote}</span>
          </div>
        </div>
      </section>`;
  }

  /* ---------- 信箱：桌上的一摞信 ---------- */
  function mailbox(state) {
    if (!state.letters.length) {
      return `
        <section class="scene mail-scene">
          <div class="scene-bg">${A.scene('hall', '<span class="scene-fallback"></span>')}</div>
          <div class="scene-vignette"></div>
          <div class="mail-empty">
            ${A.uiEnvelope()}
            <p>信箱还是空的。</p>
            <p class="muted">送一只神兽出门，它就会给你写信回来。</p>
            <button class="wood-btn small" data-act="tab" data-tab="prepare">去准备行囊</button>
          </div>
        </section>`;
    }
    const openId = ui.view.openLetter;
    const unread = state.letters.filter((l) => l.reply && l.replied == null).length;
    const WEATHERS = ['sunny', 'cloudy', 'rain', 'snow', 'night'];
    const list = state.letters
      .map((l) => {
        const open = l.id === openId;
        const needReply = !!(l.reply && l.replied == null);
        const lid = U.esc(l.id);
        const weather = WEATHERS.indexOf(l.weather) >= 0 ? l.weather : '';
        const stamp = `
          <button class="env-head" data-act="open-letter" data-letter="${lid}"
            aria-expanded="${open}" aria-controls="letter-body-${lid}">
            <span class="env-mark">${A.uiStamp()}</span>
            <span class="env-from">${U.esc(l.beastName)} · ${U.esc(l.cityName)}</span>
            <span class="env-title">${U.esc(l.title)}</span>
            ${needReply ? '<i class="env-flag">待回信</i>' : l.stage ? '<i class="env-flag gold">阶段</i>' : ''}
            <i class="env-caret" aria-hidden="true">▾</i>
          </button>`;
        const cls = `env ${open ? 'open' : ''} ${l.stage ? 'stage' : ''} ${l.visitor ? 'visitor' : ''}`;
        if (!open) return `<article class="${cls}">${stamp}</article>`;

        const causes =
          l.causes && l.causes.length
            ? `<div class="causes"><span class="causes-label">因为</span>${l.causes
                .map((c) => `<span class="cause-pill">${U.esc(c)}</span>`)
                .join('')}</div>`
            : '';
        const sou = l.souvenir ? SH.sys.souById(l.souvenir) : null;
        const souHtml = sou
          ? `<div class="gain">
               <span class="gain-art">${A.souvenir(sou)}</span>
               <span class="gain-text"><b>${sou.name}</b><em>${sou.desc}</em></span>
             </div>`
          : '';
        let replyHtml = '';
        if (l.reply) {
          if (l.replied != null) {
            replyHtml = `<div class="replied"><span class="replied-mark">已回</span><span>${U.esc(l.reply[l.replied].text)}</span> <em>${l.visitor ? '驿站记住了这句话。' : '它记住了。'}</em></div>`;
          } else {
            replyHtml = `<div class="reply-box" role="group" aria-label="回信选项">
              <p class="reply-q">你会怎样回复${U.esc(l.beastName)}？</p>
              ${l.reply
                .map(
                  (r, i) =>
                    `<button class="reply-opt" data-act="reply" data-letter="${lid}" data-idx="${i}">
                      <i aria-hidden="true">${'一二三'[i] || '·'}</i><span>${U.esc(r.text)}</span></button>`
                )
                .join('')}
            </div>`;
          }
        }
        const city = l.city ? SH.sys.cityById(l.city) : null;
        return `<article class="${cls}">
          ${stamp}
          <div class="env-body" id="letter-body-${lid}">
            <div class="sheet ${weather ? 'weather-' + weather : ''}">
              ${A.uiLetter()}
              ${city ? `<div class="sheet-photo">${A.city(city)}</div>` : ''}
              <div class="sheet-weather" aria-label="天气">${weather ? A.weatherIcon(weather) : ''}</div>
              <div class="sheet-body">${U.esc(l.body).replace(/\n/g, '<br>')}</div>
              <div class="sheet-sign">—— ${U.esc(l.beastName)}，${U.fmtDate(l.at)}</div>
            </div>
            ${causes}${souHtml}${replyHtml}
          </div>
        </article>`;
      })
      .join('');
    return `
      <section class="scene mail-scene">
        <div class="scene-bg">${A.scene('hall', '<span class="scene-fallback"></span>')}</div>
        <div class="scene-vignette"></div>
        <div class="mail-stack">
          <div class="mail-summary"><b>信箱</b><span>${state.letters.length} 封 · ${unread ? unread + ' 封待回' : '都回过了'}</span></div>
          ${list}
        </div>
      </section>`;
  }

  /* ---------- 图鉴：木架上的收藏 ---------- */
  function codex(state) {
    const prog = SH.sys.codexProgress(state);
    const bars = prog
      .map(
        (p) => `<div class="ink-row">
          <span class="ink-name">${p.name}</span>
          <span class="ink-bar" role="progressbar" aria-label="${p.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><i style="width:${p.pct}%"></i></span>
          <span class="ink-num">${p.pct}%</span>
        </div>`
      )
      .join('');

    const souWall = SH.SOUVENIRS.map((s) => {
      const n = state.souvenirs[s.id] || 0;
      const have = n > 0;
      const city = s.city === '*' ? '旅途各处' : (SH.sys.cityById(s.city) || {}).name || '';
      return `<div class="frame ${have ? 'have' : 'locked'} r-${s.rarity}" role="listitem">
        <div class="frame-art" ${have ? '' : 'aria-hidden="true"'}>${A.souvenir(s)}</div>
        <div class="frame-name">${have ? s.name : '？？？'}</div>
        <div class="frame-city">${have ? city : ''}${have && n > 1 ? ' ×' + n : ''}</div>
        ${have && s.rarity === 'legend' ? '<i class="frame-shine"></i>' : ''}
      </div>`;
    }).join('');

    const cityFoot = SH.CITIES.map((c) => {
      const n = SH.BEASTS.reduce((s, b) => s + (state.beasts[b.id].visited[c.id] || 0), 0);
      return `<div class="postcard ${n ? 'have' : 'locked'}">
        <div class="postcard-photo">${A.city(c)}</div>
        <div class="postcard-body">
          <b>${c.name}</b>
          <span>${n ? '到访 ' + n + ' 次' : '未至'}</span>
          <em>${n ? c.intro : ''}</em>
        </div>
      </div>`;
    }).join('');

    const visitors = SH.VISITORS.map((v) => {
      const un = state.visitors[v.id];
      const need = v.need.map((t) => SH.sys.tagName(t)).join('/');
      return `<div class="guest ${un ? 'have' : 'locked'}">
        <b>${un ? v.name : '？？？'}</b>
        <span>${un ? v.line : '摆出 ' + need + ' 类纪念品 ' + v.count + ' 件'}</span>
        ${un && v.bonus ? `<em>常驻：${Object.keys(v.bonus).map((t) => SH.sys.tagName(t) + ' ×' + v.bonus[t]).join('，')}</em>` : ''}
      </div>`;
    }).join('');

    return `
      <section class="scene codex-scene">
        <div class="scene-bg">${A.scene('hall', '<span class="scene-fallback"></span>')}</div>
        <div class="scene-vignette"></div>
        <div class="codex-body">
          <div class="codex-hero">
            ${A.codexCover()}
            <div>
              <h2 class="brush-title">新山海经 · 编纂进度</h2>
              <p class="hint">上古的山海图已久未更新。神兽们从人间带回的每一件纪念品、每一封信，都在把这一页补全。</p>
            </div>
          </div>
          <div class="ink-wrap">${bars}</div>

          <h2 class="brush-title">纪念品收藏 <em>${SH.sys.ownedSouvenirCount(state)}/${SH.SOUVENIRS.length}</em></h2>
          <div class="shelf" role="list" aria-label="纪念品收藏">${souWall}</div>

          <h2 class="brush-title">山河足迹</h2>
          <div class="postcard-row">${cityFoot}</div>

          <h2 class="brush-title">驿站的访客</h2>
          <div class="guest-row">${visitors}</div>
        </div>
      </section>`;
  }

  /* ---------- 驿站：屋里的一层木架 ---------- */
  function home(state) {
    const slots = [];
    for (let i = 0; i < SH.sys.SLOTS; i++) {
      const sid = state.placed[i];
      const s = sid ? SH.sys.souById(sid) : null;
      slots.push(`<button class="ledge ${s ? 'filled' : ''} ${ui.view.placingSlot === i ? 'picking' : ''}"
          data-act="slot" data-slot="${i}" aria-pressed="${!!s}"
          aria-label="${s ? `第 ${i + 1} 格，${s.name}，点击更换` : `第 ${i + 1} 格，空位，点击摆放`}">
          ${s ? `<span class="ledge-art">${A.souvenir(s)}</span><span class="ledge-name">${s.name}</span>` : `<span class="ledge-plus" aria-hidden="true">＋</span>`}
        </button>`);
    }

    let picker = '';
    if (ui.view.placingSlot != null) {
      const used = Object.keys(state.placed).map((k) => state.placed[k]);
      const slotHas = state.placed[ui.view.placingSlot];
      const opts = SH.SOUVENIRS.filter((s) => state.souvenirs[s.id] > 0)
        .map((s) => {
          const usedElsewhere = used.indexOf(s.id) >= 0 && slotHas !== s.id;
          return `<button class="pick-sou ${usedElsewhere ? 'used' : ''}" data-act="place" data-sou="${s.id}"
            aria-label="${s.name}${usedElsewhere ? '（从别处挪过来）' : ''}">
            <span class="ps-art">${A.souvenir(s)}</span>
            <span class="ps-name">${s.name}</span>
            <span class="ps-desc">${s.desc}</span>
            ${usedElsewhere ? '<span class="ps-tag">挪过来</span>' : ''}
          </button>`;
        })
        .join('');
      picker = `<div class="picker" role="region" aria-label="选择要摆放的纪念品">
        <div class="picker-head">
          <span>选一件放进这里</span>
          <button class="wood-btn tiny" data-act="clear-slot" ${slotHas ? '' : 'disabled'}>取走</button>
          <button class="wood-btn tiny" data-act="close-picker">关闭</button>
        </div>
        <div class="picker-list">${opts || '<p class="muted">还没有纪念品可以摆。先送神兽出门吧。</p>'}</div>
      </div>`;
    }

    const counts = {};
    Object.keys(state.placed).forEach((k) => {
      const s = SH.sys.souById(state.placed[k]);
      if (s) (s.attract || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
    });
    const visList = SH.VISITORS.map((v) => {
      const un = state.visitors[v.id];
      const total = v.need.reduce((n, t) => n + (counts[t] || 0), 0);
      const need = v.need.map((t) => SH.sys.tagName(t)).join(' / ');
      return `<div class="guest ${un ? 'have' : 'locked'}">
        <b>${un ? v.name : '？？？'}</b>
        <span>${un ? v.line : need + ' 类：' + Math.min(total, v.count) + ' / ' + v.count}</span>
        ${un && v.letter ? '<em>已寄来一封信</em>' : ''}
      </div>`;
    }).join('');

    return `
      <section class="scene home-scene">
        <div class="scene-bg">${A.scene('hall', '<span class="scene-fallback"></span>')}</div>
        <div class="scene-vignette"></div>
        <div class="home-body">
          <h2 class="brush-title">山海驿站 · 陈设</h2>
          <p class="hint">点空位摆上纪念品。摆得多了，会有人找上门来。</p>
          <div class="board">${A.uiShelf()}<div class="ledge-row">${slots.join('')}</div></div>
          ${picker}
          <h2 class="brush-title">来过的人</h2>
          <div class="guest-row">${visList}</div>
        </div>
      </section>`;
  }

  /* ---------- 底部工具（收进小抽屉，不占主视线） ---------- */
  function drawer(state) {
    const left = SH.sys.hourglassLeft(state);
    return `<footer class="drawer">
      <div class="drawer-main">
        <button class="wood-btn tiny" data-act="supply">${A.miscIcon('gift')}<span>补给</span></button>
        <label class="switch"><input type="checkbox" data-act="fast" ${state.settings.fastMode ? 'checked' : ''}> 快速模式</label>
        <span class="drawer-note">沙漏 ${left}/${SH.sys.HOURGLASS_LIMIT}</span>
        <button class="wood-btn tiny" data-act="toggle-drawer" aria-expanded="${ui.view.drawerOpen}">
          ${ui.view.drawerOpen ? '收起设置' : '设置与存档'}
        </button>
      </div>
      ${ui.view.drawerOpen ? `<div class="drawer-more">
        <button class="wood-btn tiny" data-act="export">导出存档</button>
        <button class="wood-btn tiny" data-act="import">导入存档</button>
        <button class="wood-btn tiny danger" data-act="reset">重置存档</button>
      </div>` : ''}
    </footer>`;
  }

  /* ---------- 总渲染 ---------- */
  ui.render = function () {
    const state = SH.state;
    const body =
      ui.view.tab === 'yard' ? yard(state)
      : ui.view.tab === 'prepare' ? prepare(state)
      : ui.view.tab === 'mailbox' ? mailbox(state)
      : ui.view.tab === 'codex' ? codex(state)
      : home(state);

    const active = document.activeElement;
    const focus = actKey(active);
    const sx = window.scrollX;
    const sy = window.scrollY;

    document.getElementById('app').innerHTML =
      `<div class="room">${A.uiPaper()}${plaque(state)}<main class="stage">${body}${drawer(state)}</main>${dock()}</div>`;

    if (focus) {
      const next = Array.from(document.querySelectorAll('[data-act]')).find((el) => actKey(el) === focus);
      if (next) next.focus({ preventScroll: true });
    }
    window.scrollTo(sx, sy);
  };
})();
